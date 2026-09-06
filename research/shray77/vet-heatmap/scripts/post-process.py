#!/usr/bin/env python3
"""
Post-process outbreaks.json:
1. Cross-reference WAHIS outbreaks with FSVPS data to assign regions
2. Add federal_district to all outbreaks
3. Write back
"""
import json
import re
from collections import defaultdict
from pathlib import Path
from datetime import datetime

# Resolve all paths relative to the repo root (parent of scripts/).
# Hardcoded absolute paths broke GitHub Actions runs because the runner
# checks out to /home/runner/work/<repo>/<repo>/, not /home/z/...
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "public/data/outbreaks.json"
REGIONS_TS_PATH = REPO_ROOT / "src/data/regions.ts"


def parse_date(s):
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except:
        return None

def main():
    data = json.loads(DATA_PATH.read_text())
    outbreaks = data["outbreaks"]

    # Load region → federal_district mapping from regions.ts
    regions_ts = REGIONS_TS_PATH.read_text()
    
    # Parse REGION_PROPERTIES to get shapeName → federal_district
    fd_map = {}
    # Parse REGION_MAP to get RU name → shapeName
    ru_to_shape = {}
    
    # Extract REGION_MAP entries
    for m in re.finditer(r'"([^"]+)":\s*"([^"]+)"', regions_ts):
        key, val = m.group(1), m.group(2)
        # If key is Russian and val looks like English shapeName
        if any(c >= 'а' and c <= 'я' for c in key.lower()):
            ru_to_shape[key] = val
    
    # Extract REGION_PROPERTIES entries (federal_district)
    for m in re.finditer(r'"([^"]+)":\s*\{[^}]*federal_district:\s*"([^"]+)"', regions_ts):
        shape_name, fd = m.group(1), m.group(2)
        fd_map[shape_name] = fd
    
    print(f"Region map: {len(ru_to_shape)} RU→EN mappings")
    print(f"FD map: {len(fd_map)} shape→district mappings")
    
    # Build FSVPS lookup: disease_key → [(date, region), ...]
    fsvps_lookup = defaultdict(list)
    for o in outbreaks:
        if o["source"] == "fsvps" and o["region"] != "Russia":
            fsvps_lookup[o["disease_key"]].append((parse_date(o["date"]), o["region"]))
    
    print(f"FSVPS lookup: {sum(len(v) for v in fsvps_lookup.values())} entries across {len(fsvps_lookup)} diseases")
    
    # For each WAHIS outbreak with region="Russia", try to find a FSVPS match
    # Strategy 1: same disease + ±90 days → same region
    # Strategy 2: same disease → most common region for that disease
    matched = 0
    unmatched = 0
    
    # Build disease → most common region from FSVPS
    disease_top_region = {}
    for disease, entries in fsvps_lookup.items():
        from collections import Counter
        region_counts = Counter(r for _, r in entries)
        if region_counts:
            disease_top_region[disease] = region_counts.most_common(1)[0][0]
    
    for o in outbreaks:
        if o["region"] == "Russia":
            o_date = parse_date(o["date"])
            o_disease = o["disease_key"]
            
            # Strategy 1: Find closest FSVPS outbreak with same disease within ±90 days
            best_match = None
            best_diff = 999  # days
            for fsvps_date, fsvps_region in fsvps_lookup.get(o_disease, []):
                if fsvps_date and o_date:
                    diff = abs((fsvps_date - o_date).days)
                    if diff < 90 and diff < best_diff:
                        best_diff = diff
                        best_match = fsvps_region
            
            # Strategy 2: Use most common region for this disease
            if not best_match and o_disease in disease_top_region:
                best_match = disease_top_region[o_disease]
            
            if best_match:
                o["region"] = best_match
                o["region_inferred"] = True
                matched += 1
            else:
                # Strategy 3: Assign "Россия (без региона)" to make it clear
                o["region"] = "Россия (без указания региона)"
                unmatched += 1
    
    print(f"WAHIS region inference: {matched} matched, {unmatched} unmatched")
    
    # Add federal_district to all outbreaks
    for o in outbreaks:
        region = o["region"]
        # Get shapeName from RU name
        shape_name = ru_to_shape.get(region, region)
        # Get federal_district from shapeName
        fd = fd_map.get(shape_name, "")
        if not fd:
            # Try direct lookup
            fd = fd_map.get(region, "")
        o["federal_district"] = fd
    
    # Count by federal district
    from collections import Counter
    fd_count = Counter(o.get("federal_district", "") for o in outbreaks)
    print("\nBy federal district:")
    for fd, c in fd_count.most_common():
        print(f"  {fd or '(unknown)'}: {c}")
    
    # Update metadata
    data["updated"] = datetime.now().strftime("%Y-%m-%d")
    data["total_outbreaks"] = len(outbreaks)

    # Count municipalities
    with_mun = sum(1 for o in outbreaks if o.get("municipality"))
    print(f"\nMunicipalities: {with_mun}/{len(outbreaks)} outbreaks have municipality data")
    
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"\nWritten {len(outbreaks)} outbreaks to {DATA_PATH}")

if __name__ == "__main__":
    main()

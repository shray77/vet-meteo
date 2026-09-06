import json
d = json.load(open('data/geo/russia_adm1.geojson', 'r', encoding='utf-8'))
print("Properties:", list(d['features'][0]['properties'].keys()))
print("First feature props:", d['features'][0]['properties'])

/**
 * Telegram Channel Alert Scraper (@vetrfru / VetIS.News).
 *
 * Strategy:
 *   1. Fetch public web view at https://t.me/s/vetrfru
 *   2. Extract message text nodes and publication timestamps
 *   3. Filter messages for veterinary outbreak keywords (АЧС, Ящур, Бешенство, Грипп птиц, etc.)
 *   4. Parse disease, region, and status to generate RawArticle / Outbreak objects for real-time alerts.
 */

import type { RawArticle } from "../../../src/types/domain";
import { normalizeDisease } from "../../../src/data/diseases-normalize";
import { normalizeRegion } from "../../../src/data/regions";

export interface TelegramMessage {
  id: string;
  url: string;
  date: string; // ISO date YYYY-MM-DD
  text: string;
}

const TELEGRAM_CHANNEL_URL = "https://t.me/s/vetrfru";

export function parseTelegramHtml(html: string): TelegramMessage[] {
  const messages: TelegramMessage[] = [];
  const messageBlocks = html.split('<div class="tgme_widget_message ');

  for (const block of messageBlocks.slice(1)) {
    // Extract message ID / link
    const linkMatch = block.match(/href="(https:\/\/t\.me\/vetrfru\/\d+)"/);
    const link = linkMatch ? linkMatch[1] : "";
    const msgId = link ? link.split("/").pop() || "" : "";

    // Extract ISO date from time tag
    const dateMatch = block.match(/datetime="([^"]+)"/);
    const rawDate = dateMatch ? dateMatch[1] : "";
    const date = rawDate ? rawDate.split("T")[0] : new Date().toISOString().split("T")[0];

    // Extract text content from message text div
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let text = textMatch ? textMatch[1] : "";

    // Clean HTML tags and brs
    text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();

    if (text && msgId) {
      messages.push({
        id: msgId,
        url: link,
        date,
        text,
      });
    }
  }

  return messages;
}

export function parseTelegramAlerts(messages: TelegramMessage[]): RawArticle[] {
  const articles: RawArticle[] = [];

  for (const msg of messages) {
    const text = msg.text;
    const diseaseKey = normalizeDisease(text);
    const regionName = normalizeRegion(text);

    articles.push({
      source: "fsvps" as const, // closest SourceKey — telegram is a notification mirror
      url: msg.url,
      title: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
      published_at: msg.date,
      body_text: text,
      detected_disease: diseaseKey !== "other" ? diseaseKey : undefined,
      detected_region: regionName || undefined,
    });
  }

  return articles;
}

export async function scrapeTelegram(): Promise<RawArticle[]> {
  try {
    const res = await fetch(TELEGRAM_CHANNEL_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const messages = parseTelegramHtml(html);
    return parseTelegramAlerts(messages);
  } catch (err) {
    console.error("[telegram-scraper] Error fetching channel:", err);
    return [];
  }
}

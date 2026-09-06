import { describe, it, expect } from "vitest";
import { parseTelegramHtml, parseTelegramAlerts, TelegramMessage } from "./telegram";

describe("Telegram Scraper", () => {
  it("should parse messages from Telegram HTML widget", () => {
    const mockHtml = `
      <div class="tgme_widget_message js-widget_message">
        <a class="tgme_widget_message_date" href="https://t.me/vetrfru/101">
          <time datetime="2026-07-25T14:30:00+00:00"></time>
        </a>
        <div class="tgme_widget_message_text js-message_text">
          Вспышка АЧС зафиксирована в Иркутской области на территории свинокомплекса.
        </div>
      </div>
    `;

    const messages = parseTelegramHtml(mockHtml);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("101");
    expect(messages[0].date).toBe("2026-07-25");
    expect(messages[0].text).toContain("АЧС зафиксирована в Иркутской области");
  });

  it("should extract RawArticles with disease and status from messages", () => {
    const messages: TelegramMessage[] = [
      {
        id: "101",
        url: "https://t.me/vetrfru/101",
        date: "2026-07-25",
        text: "Вспышка АЧС Африканская чума свиней зафиксирована в Иркутской области",
      },
      {
        id: "102",
        url: "https://t.me/vetrfru/102",
        date: "2026-07-26",
        text: "Снятие карантина по бешенству животных в Алтайском крае",
      },
    ];

    const articles = parseTelegramAlerts(messages);
    expect(articles).toHaveLength(2);

    expect(articles[0].detected_disease).toBe("asf");
    expect(articles[0].body_text).toContain("Иркутской области");

    expect(articles[1].detected_disease).toBe("rabies");
    expect(articles[1].body_text).toContain("Алтайском крае");
  });
});

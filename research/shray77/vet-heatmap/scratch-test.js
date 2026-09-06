const url = "https://fsvps.gov.ru/jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/page/2/";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html"
  }
}).then(res => {
  console.log("Status:", res.status);
  return res.text();
}).then(html => {
  const matches = html.match(/href="(https?:\/\/[^"]+\.pdf)"/g);
  console.log("PDFs on page 2:", matches?.length || 0);
}).catch(console.error);

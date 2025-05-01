// bot.ts
import { Builder, Browser, By, until, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { startWebSocketServer } from "./ws";
import path from "path";

const MEET_URL = "https://meet.google.com/rbq-xawq-chm";

async function openMeet(driver: WebDriver) {
  await driver.get(MEET_URL);

  // Accept "Got it" popup
  try {
    const popupButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Got it")]')),
      10000
    );
    await popupButton.click();
  } catch (e) {}

  // Fill name if prompted
  try {
    const nameInput = await driver.wait(
      until.elementLocated(By.xpath('//input[@placeholder="Your name"]')),
      5000
    );
    await nameInput.clear();
    await nameInput.sendKeys("Meeting bot");
  } catch (e) {}

  // Click "Ask to join"
  try {
    const joinButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Ask to join")]')),
      10000
    );
    await joinButton.click();
  } catch (e) {}
}

async function muteMeetSpeaker(driver: WebDriver) {
  try {
    // Open the "More options" menu (three dots)
    const moreOptionsButton = await driver.wait(
      until.elementLocated(By.css('[aria-label="More options"]')),
      10000
    );
    await moreOptionsButton.click();
    await driver.sleep(500); // Wait for menu to open

    // Click "Turn off sound"
    const soundButton = await driver.wait(
      until.elementLocated(
        By.xpath("//span[contains(text(), 'Turn off sound')]")
      ),
      5000
    );
    await soundButton.click();
    await driver.sleep(500); // Wait for action to complete

    // Optionally, close the menu (by pressing Escape)
    await driver.actions().sendKeys("\uE00C").perform(); // ESC key
  } catch (e) {
    console.log("Speaker mute option not found or already muted.");
  }
}

async function muteMeetAudio(driver: WebDriver) {
  // Mute microphone
  try {
    // Try to find the mic button (may vary by UI version)
    const micButton = await driver.wait(
      until.elementLocated(
        By.css(
          '[aria-label*="Turn off microphone"], [aria-label*="Mute microphone"]'
        )
      ),
      5000
    );
    await micButton.click();
  } catch (e) {}

  // Mute speakers (if available)
  try {
    // Open "More options" menu
    const moreOptionsButton = await driver.findElement(
      By.css('[aria-label="More options"]')
    );
    await moreOptionsButton.click();
    await driver.sleep(500);

    // Find and click "Turn off sound"
    const soundButton = await driver.findElement(
      By.xpath("//span[contains(text(), 'Turn off sound')]")
    );
    await soundButton.click();
  } catch (e) {}
}

async function getDriver() {
  const options = new Options();
  options.addArguments(
    "--disable-blink-features=AutomationControlled",
    "--use-fake-ui-for-media-stream",
    "--window-size=1920,1080",
    "--auto-select-desktop-capture-source=[RECORD]",
    "--enable-usermedia-screen-capturing",
    "--allow-running-insecure-content",
    "--disable-notifications",
    "--no-sandbox",
    "--disable-gpu"
    // "--headless" // Uncomment for headless mode
  );
  return await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();
}

async function startScreenshare(driver: WebDriver) {
  await driver.executeScript(`
    (async () => {
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise(res => ws.onopen = res);

      // Wait for the page to be fully ready
      await new Promise(res => setTimeout(res, 3000));

      // Only capture tab/system audio (not mic)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp8,opus",
        videoBitsPerSecond: 1800000
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && ws.readyState === 1) {
          ws.send(event.data);
        }
      };

      recorder.onstop = () => {
        ws.close();
      };

      recorder.start(10000); // 10-second chunks
      window.recorder = recorder; // For manual stop/debug
    })();
  `);

  // Keep the driver alive while recording
  await driver.sleep(60 * 60 * 1000); // 1 hour
}

async function main() {
  startWebSocketServer(3001);
  const driver = await getDriver();
  await openMeet(driver);
  await muteMeetAudio(driver); // Mute mic and speakers
  await new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
  await startScreenshare(driver);
}

main();

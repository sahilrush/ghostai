"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// bot.ts
const selenium_webdriver_1 = require("selenium-webdriver");
const chrome_1 = require("selenium-webdriver/chrome");
const ws_1 = require("./ws");
const MEET_URL = "https://meet.google.com/rbq-xawq-chm";
function openMeet(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        yield driver.get(MEET_URL);
        // Accept "Got it" popup
        try {
            const popupButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Got it")]')), 10000);
            yield popupButton.click();
        }
        catch (e) { }
        // Fill name if prompted
        try {
            const nameInput = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//input[@placeholder="Your name"]')), 5000);
            yield nameInput.clear();
            yield nameInput.sendKeys("Meeting bot");
        }
        catch (e) { }
        // Click "Ask to join"
        try {
            const joinButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Ask to join")]')), 10000);
            yield joinButton.click();
        }
        catch (e) { }
    });
}
function muteMeetSpeaker(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Open the "More options" menu (three dots)
            const moreOptionsButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.css('[aria-label="More options"]')), 10000);
            yield moreOptionsButton.click();
            yield driver.sleep(500); // Wait for menu to open
            // Click "Turn off sound"
            const soundButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath("//span[contains(text(), 'Turn off sound')]")), 5000);
            yield soundButton.click();
            yield driver.sleep(500); // Wait for action to complete
            // Optionally, close the menu (by pressing Escape)
            yield driver.actions().sendKeys("\uE00C").perform(); // ESC key
        }
        catch (e) {
            console.log("Speaker mute option not found or already muted.");
        }
    });
}
function muteMeetAudio(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        // Mute microphone
        try {
            // Try to find the mic button (may vary by UI version)
            const micButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.css('[aria-label*="Turn off microphone"], [aria-label*="Mute microphone"]')), 5000);
            yield micButton.click();
        }
        catch (e) { }
        // Mute speakers (if available)
        try {
            // Open "More options" menu
            const moreOptionsButton = yield driver.findElement(selenium_webdriver_1.By.css('[aria-label="More options"]'));
            yield moreOptionsButton.click();
            yield driver.sleep(500);
            // Find and click "Turn off sound"
            const soundButton = yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'Turn off sound')]"));
            yield soundButton.click();
        }
        catch (e) { }
    });
}
function getDriver() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = new chrome_1.Options();
        options.addArguments("--disable-blink-features=AutomationControlled", "--use-fake-ui-for-media-stream", "--window-size=1920,1080", "--auto-select-desktop-capture-source=[RECORD]", "--enable-usermedia-screen-capturing", "--allow-running-insecure-content", "--disable-notifications", "--no-sandbox", "--disable-gpu"
        // "--headless" // Uncomment for headless mode
        );
        return yield new selenium_webdriver_1.Builder()
            .forBrowser(selenium_webdriver_1.Browser.CHROME)
            .setChromeOptions(options)
            .build();
    });
}
function startScreenshare(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        yield driver.executeScript(`
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
        yield driver.sleep(60 * 60 * 1000); // 1 hour
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, ws_1.startWebSocketServer)(3001);
        const driver = yield getDriver();
        yield openMeet(driver);
        yield muteMeetAudio(driver); // Mute mic and speakers
        yield new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
        yield startScreenshare(driver);
    });
}
main();

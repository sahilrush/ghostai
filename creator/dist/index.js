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
var MeetingEndReason;
(function (MeetingEndReason) {
    MeetingEndReason["REMOVED"] = "removed";
    MeetingEndReason["ENDED"] = "ended";
    MeetingEndReason["ALONE"] = "alone";
})(MeetingEndReason || (MeetingEndReason = {}));
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
function muteMeetAudio(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        // Mute microphone
        try {
            const micButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.css('[aria-label*="Turn off microphone"], [aria-label*="Mute microphone"]')), 5000);
            yield micButton.click();
        }
        catch (e) { }
        // Mute speakers (if available)
        try {
            const moreOptionsButton = yield driver.findElement(selenium_webdriver_1.By.css('[aria-label="More options"]'));
            yield moreOptionsButton.click();
            yield driver.sleep(500);
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

      await new Promise(res => setTimeout(res, 3000));

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp8,opus",
        videoBitsPerSecond: 1800000
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && ws.readyState === 1) {
          ws.send(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (ws.readyState === 1) ws.close();
      };

      mediaRecorder.start(10000); // 10-second chunks
      window.mediaRecorder = mediaRecorder;
      window.ws = ws;

      window.stopRecording = () => {
        try {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          if (ws && ws.readyState === 1) {
            ws.close();
          }
        } catch (err) {}
      };
    })();
  `);
    });
}
function waitForMeetingToEndOrAlone(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        let aloneSince = null;
        const ALONE_TIMEOUT = 3 * 60 * 1000; // 3 minutes
        while (true) {
            let participantCount = 1;
            try {
                // Try to get participant count from the Meet UI (top right button)
                const countElem = yield driver.findElement(selenium_webdriver_1.By.css('[aria-label^="Participants"]'));
                const label = yield countElem.getAttribute("aria-label");
                const match = label.match(/(\d+)/);
                if (match)
                    participantCount = parseInt(match[1], 10);
            }
            catch (e) {
                // Fallback: count participant tiles
                try {
                    const tiles = yield driver.findElements(selenium_webdriver_1.By.css('div[role="listitem"]'));
                    participantCount = tiles.length;
                }
                catch (e2) {
                    participantCount = 1;
                }
            }
            // Check for meeting end or removal
            try {
                yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'You’ve been removed')]"));
                return MeetingEndReason.REMOVED;
            }
            catch (e) { }
            try {
                yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'Meeting ended')]"));
                return MeetingEndReason.ENDED;
            }
            catch (e) { }
            // Check if alone
            if (participantCount <= 1) {
                if (!aloneSince)
                    aloneSince = Date.now();
                if (Date.now() - aloneSince > ALONE_TIMEOUT) {
                    console.log("Alone for 3 minutes, exiting...");
                    return MeetingEndReason.ALONE;
                }
            }
            else {
                aloneSince = null;
            }
            yield driver.sleep(5000); // Check every 5 seconds
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, ws_1.startWebSocketServer)(3001);
        const driver = yield getDriver();
        yield openMeet(driver);
        yield muteMeetAudio(driver);
        yield new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
        yield startScreenshare(driver);
        // Wait for meeting end or alone timeout
        const reason = yield waitForMeetingToEndOrAlone(driver);
        // Stop recording gracefully before quitting
        try {
            yield driver.executeScript(`if(window.stopRecording) window.stopRecording();`);
            yield driver.sleep(2000); // Give time for recorder to finish
        }
        catch (e) {
            console.log("Could not stop recording gracefully:", e);
        }
        yield driver.quit();
        process.exit(0);
    });
}
main();

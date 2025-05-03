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
const constants_1 = require("./constants");
// Logging utility
const log = {
    info: (message, ...args) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    },
    debug: (message, ...args) => {
        console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    },
};
const MEET_URL = "https://meet.google.com/rbq-xawq-chm";
var MeetingEndReason;
(function (MeetingEndReason) {
    MeetingEndReason["REMOVED"] = "removed";
    MeetingEndReason["ENDED"] = "ended";
    MeetingEndReason["ALONE"] = "alone";
})(MeetingEndReason || (MeetingEndReason = {}));
function openMeet(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        log.info("Opening Google Meet...");
        yield driver.get(MEET_URL);
        // Accept "Got it" popup
        try {
            const popupButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Got it")]')), 10000);
            yield popupButton.click();
            log.info("Accepted 'Got it' popup");
        }
        catch (e) {
            log.warn("No 'Got it' popup found or timed out");
        }
        // Fill name if prompted
        try {
            const nameInput = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//input[@placeholder="Your name"]')), 5000);
            yield nameInput.clear();
            yield nameInput.sendKeys("Meeting bot");
            log.info("Filled in bot name");
        }
        catch (e) {
            log.warn("No name input found or timed out");
        }
        // Click "Ask to join"
        try {
            const joinButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Ask to join")]')), 10000);
            yield joinButton.click();
            log.info("Clicked 'Ask to join' button");
        }
        catch (e) {
            log.error("Failed to click 'Ask to join' button:", e);
        }
    });
}
function muteMeetAudio(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        log.info("Muting audio...");
        // Mute microphone
        try {
            const micButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.css('[aria-label*="Turn off microphone"], [aria-label*="Mute microphone"]')), 5000);
            yield micButton.click();
            log.info("Microphone muted");
        }
        catch (e) {
            log.warn("Failed to mute microphone:", e);
        }
        // Mute speakers (if available)
        try {
            const moreOptionsButton = yield driver.findElement(selenium_webdriver_1.By.css('[aria-label="More options"]'));
            yield moreOptionsButton.click();
            yield driver.sleep(500);
            const soundButton = yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'Turn off sound')]"));
            yield soundButton.click();
            log.info("Speakers muted");
        }
        catch (e) {
            log.warn("Failed to mute speakers:", e);
        }
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
        log.info("Starting screen share recording...");
        yield driver.executeScript(`
        (async () => {
        const ws = new WebSocket('ws://localhost:3001');
        let wsReady = false;

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
            wsReady = true;
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            wsReady = false;
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
            wsReady = false;
        };

        const mediaStreamOptions = ${JSON.stringify(constants_1.CHROME_CONSTANTS.MEDIA_STREAM_OPTIONS)};
        const stream = await navigator.mediaDevices.getDisplayMedia(mediaStreamOptions);

        const audioContext = new AudioContext();
        const audioEl1 = document.querySelectorAll("audio")[0];
        const audioEl2 = document.querySelectorAll("audio")[1];
        const audioEl3 = document.querySelectorAll("audio")[2];
        const audioStream1 = audioContext.createMediaStreamSource(audioEl1.srcObject)
        const audioStream2 = audioContext.createMediaStreamSource(audioEl2.srcObject)
        const audioStream3 = audioContext.createMediaStreamSource(audioEl3.srcObject)

        const dest = audioContext.createMediaStreamDestination();
        audioStream1.connect(dest)
        audioStream2.connect(dest)
        audioStream3.connect(dest)

        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: "video/webm; codecs=vp8,opus",
            timeSlice: 10000,
            videoBitsPerSecond: 1800000,
        });

        console.log("Starting media recording...");
        mediaRecorder.start(10000);

        mediaRecorder.ondataavailable = (event) => {
            if (wsReady) {
            try {
                ws.send(event.data);
                console.log('Sent data');
            } catch (error) {
                console.error('Error sending chunk:', error);
            }
            } else {
            console.error('WebSocket is not ready to send data');
            }
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            ws.close();
            console.log('Media recording stopped');
        };

        window.stopRecording = () => {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                ws.close();
            }
        };
        })();
    `);
        log.info("Screen share recording started");
    });
}
function waitForMeetingToEndOrAlone(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        log.info("Waiting for meeting to end or alone timeout...");
        let aloneSince = null;
        const ALONE_TIMEOUT = 3 * 60 * 1000; // 3 minutes
        while (true) {
            let participantCount = 1;
            try {
                // Method 1: Try to get participant count from the Meet UI (top right button)
                const countElem = yield driver.findElement(selenium_webdriver_1.By.css('[aria-label^="Participants"]'));
                const label = yield countElem.getAttribute("aria-label");
                const match = label.match(/(\d+)/);
                if (match) {
                    participantCount = parseInt(match[1], 10);
                    log.debug(`Method 1 - Participant count from UI: ${participantCount}`);
                }
            }
            catch (e) {
                log.debug("Method 1 failed to get participant count");
            }
            // Method 2: Count participant tiles
            try {
                const tiles = yield driver.findElements(selenium_webdriver_1.By.css('div[role="listitem"]'));
                const tileCount = tiles.length;
                log.debug(`Method 2 - Participant tiles count: ${tileCount}`);
                // Use the higher count between methods
                participantCount = Math.max(participantCount, tileCount);
            }
            catch (e) {
                log.debug("Method 2 failed to get participant count");
            }
            // Method 3: Check for active video streams
            try {
                const videoElements = yield driver.findElements(selenium_webdriver_1.By.css("video[src]"));
                const videoCount = videoElements.length;
                log.debug(`Method 3 - Active video streams: ${videoCount}`);
                // Use the higher count between methods
                participantCount = Math.max(participantCount, videoCount);
            }
            catch (e) {
                log.debug("Method 3 failed to get participant count");
            }
            // Method 4: Check for participant names
            try {
                const nameElements = yield driver.findElements(selenium_webdriver_1.By.css("[data-participant-id]"));
                const nameCount = nameElements.length;
                log.debug(`Method 4 - Participant names count: ${nameCount}`);
                // Use the higher count between methods
                participantCount = Math.max(participantCount, nameCount);
            }
            catch (e) {
                log.debug("Method 4 failed to get participant count");
            }
            log.debug(`Final participant count: ${participantCount}`);
            // Check for meeting end or removal
            try {
                yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'You've been removed')]"));
                log.info("Meeting ended: User was removed");
                return MeetingEndReason.REMOVED;
            }
            catch (e) { }
            try {
                yield driver.findElement(selenium_webdriver_1.By.xpath("//span[contains(text(), 'Meeting ended')]"));
                log.info("Meeting ended: Meeting was ended");
                return MeetingEndReason.ENDED;
            }
            catch (e) { }
            // Check if alone
            if (participantCount <= 1) {
                if (!aloneSince) {
                    aloneSince = Date.now();
                    log.info("Meeting is empty, starting alone timer");
                }
                if (Date.now() - aloneSince > ALONE_TIMEOUT) {
                    log.info("Alone for 3 minutes, exiting...");
                    return MeetingEndReason.ALONE;
                }
            }
            else {
                if (aloneSince) {
                    log.info(`Participants detected (${participantCount}), resetting alone timer`);
                    aloneSince = null;
                }
            }
            yield driver.sleep(5000); // Check every 5 seconds
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        log.info("Starting recording process...");
        (0, ws_1.startWebSocketServer)(3001);
        const driver = yield getDriver();
        yield openMeet(driver);
        yield muteMeetAudio(driver);
        log.info("Waiting for host to admit...");
        yield new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
        yield startScreenshare(driver);
        // Wait for meeting end or alone timeout
        const reason = yield waitForMeetingToEndOrAlone(driver);
        log.info(`Meeting ended with reason: ${reason}`);
        // Stop recording gracefully before quitting
        try {
            log.info("Stopping recording...");
            yield driver.executeScript(`if(window.stopRecording) window.stopRecording();`);
            yield driver.sleep(2000); // Give time for recorder to finish
            log.info("Recording stopped successfully");
        }
        catch (e) {
            log.error("Could not stop recording gracefully:", e);
        }
        log.info("Closing browser...");
        yield driver.quit();
        log.info("Process completed successfully");
        process.exit(0);
    });
}
main();

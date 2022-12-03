const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
let successMessage = "Sent Successfully.";

class PagerDuty extends NotificationProvider {
    name = "PagerDuty";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            if (heartbeatJSON == null) {
                const title = "Monitor State Alert";
                const monitor = {
                    type: "ping",
                    url: "Monitor State Test Button",
                };
                return this.postNotification(notification, title, msg, monitor);
            }

            if (heartbeatJSON.status === UP) {
                const title = "Monitor State Monitor ✅ Up";
                const eventAction = notification.pagerdutyAutoResolve || null;

                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, eventAction);
            }

            if (heartbeatJSON.status === DOWN) {
                const title = "Monitor State Monitor 🔴 Down";
                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, "trigger");
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Check if result is successful, result code should be in range 2xx
     * @param {Object} result Axios response object
     * @throws {Error} The status code is not in range 2xx
     */
    checkResult(result) {
        if (result.status == null) {
            throw new Error("PagerDuty notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("PagerDuty notification failed with status code " + result.status);
        }
    }

    /**
     * Send the message
     * @param {BeanModel} notification Message title
     * @param {string} title Message title
     * @param {string} body Message
     * @param {Object} monitorInfo Monitor details (For Up/Down only)
     * @param {?string} eventAction Action event for PagerDuty (trigger, acknowledge, resolve)
     * @returns {string}
     */
    async postNotification(notification, title, body, monitorInfo, eventAction = "trigger") {

        if (eventAction == null) {
            return "No action required";
        }

        let monitorUrl;
        if (monitorInfo.type === "port") {
            monitorUrl = monitorInfo.hostname;
            if (monitorInfo.port) {
                monitorUrl += ":" + monitorInfo.port;
            }
        } else if (monitorInfo.hostname != null) {
            monitorUrl = monitorInfo.hostname;
        } else {
            monitorUrl = monitorInfo.url;
        }

        const options = {
            method: "POST",
            url: notification.pagerdutyIntegrationUrl,
            headers: { "Content-Type": "application/json" },
            data: {
                payload: {
                    summary: `[${title}] [${monitorInfo.name}] ${body}`,
                    severity: notification.pagerdutyPriority || "warning",
                    source: monitorUrl,
                },
                routing_key: notification.pagerdutyIntegrationKey,
                event_action: eventAction,
                dedup_key: "Monitor State/" + monitorInfo.id,
            }
        };

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorInfo) {
            options.client = "Monitor State";
            options.client_url = baseURL + getMonitorRelativeURL(monitorInfo.id);
        }

        let result = await axios.request(options);
        this.checkResult(result);
        if (result.statusText != null) {
            return "PagerDuty notification succeed: " + result.statusText;
        }

        return successMessage;
    }
}

module.exports = PagerDuty;

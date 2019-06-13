/*
 * Represents a single IRC server from config.yaml
 */
const logging = require("../logging");
const IrcClientConfig = require("../models/IrcClientConfig");
const log = logging.get("IrcServer");
const BridgedClient = require("./BridgedClient");
const GROUP_ID_REGEX = /^\+\S+:\S+$/;

export class IrcServer {
    private readonly addresses: string[];
    private readonly groupIdValid: boolean;

    /**
     * Construct a new IRC Server.
     * @param {string} domain : The IRC network address
     * @param {Object} config : The config options for this network.
     * @param {string} homeserverDomain : The domain of the homeserver
     * e.g "matrix.org"
     * @param {Number} expiryTimeSeconds : How old a matrix message can be
     * before it is considered 'expired' and not sent to IRC. If 0, messages
     * will never expire.
     */
    constructor(public readonly domain: string, private config: any, public readonly homeserverDomain: string, private expiryTimeSeconds: number) {
        this.addresses = config.additionalAddresses || [];
        this.addresses.push(domain);
        if (config.dynamicChannels.groupId !== undefined &&
            config.dynamicChannels.groupId.trim() !== "") {
            this.groupIdValid = GROUP_ID_REGEX.exec(this.config.dynamicChannels.groupId) !== null;
            if (!this.groupIdValid) {
                log.warn(`${domain} has an incorrectly configured groupId for dynamicChannels and will not set groups.`);
            }
        }
        else {
            this.groupIdValid = false;
        }
    }

    /**
     * Get how old a matrix message can be (in seconds) before it is considered
     * 'expired' and not sent to IRC.
     * @return {Number} The number of seconds. If 0, they never expire.
     */
    public getExpiryTimeSeconds() {
        return this.expiryTimeSeconds || 0;
    }

    /**
     * Get a string that represents the human-readable name for a server.
     * @return {string} this.config.name if truthy, otherwise it will return
     * an empty string.
     */
    public getReadableName() {
        let name = this.config.name;
        if (name) {
            return name;
        }
        return '';
    }

    /**
     * Return a randomised server domain from the default and additional addresses.
     * @return {string}
     */
    public randomDomain() {
        return this.addresses[Math.floor((Math.random() * 1000) % this.addresses.length)];
    }

    /**
     * Returns the network ID of this server, which should be unique across all
     * IrcServers on the bridge. Defaults to the domain of this IrcServer.
     * @return {string} this.config.networkId || this.domain
     */
    public getNetworkId() {
        return this.config.networkId || this.domain;
    }

    /**
     * Returns whether the server is configured to wait getQuitDebounceDelayMs before
     * parting a user that has disconnected due to a net-split.
     * @return {Boolean} this.config.quitDebounce.enabled.
     */
    public shouldDebounceQuits() {
        return this.config.quitDebounce.enabled;
    }

    /**
     * Get the minimum number of ms to debounce before bridging a QUIT to Matrix
     * during a detected net-split. If the user rejoins a channel before bridging
     * the quit to a leave, the leave will not be sent.
     * @return {number}
     */
    public getQuitDebounceDelayMinMs() {
        return this.config.quitDebounce.delayMinMs;
    }

    /**
     * Get the maximum number of ms to debounce before bridging a QUIT to Matrix
     * during a detected net-split. If a leave is bridged, it will occur at a
     * random time between delayMinMs (see above) delayMaxMs.
     * @return {number}
     */
    public getQuitDebounceDelayMaxMs() {
        return this.config.quitDebounce.delayMaxMs;
    }

    /**
     * Get the rate of maximum quits received per second before a net-split is
     * detected. If the rate of quits received becomes higher that this value,
     * a net split is considered ongoing.
     * @return {number}
     */
    public getDebounceQuitsPerSecond() {
        return this.config.quitDebounce.quitsPerSecond;
    }

    /**
     * Get a map that converts IRC user modes to Matrix power levels.
     * @return {Object}
     */
    public getModePowerMap() {
        return this.config.modePowerMap || {};
    }

    public getHardCodedRoomIds() {
        var roomIds = new Set();
        var channels = Object.keys(this.config.mappings);
        channels.forEach((chan) => {
            this.config.mappings[chan].forEach((roomId) => {
                roomIds.add(roomId);
            });
        });
        return Array.from(roomIds.keys());
    }

    public shouldSendConnectionNotices() {
        return this.config.sendConnectionMessages;
    }

    public isBotEnabled() {
        return this.config.botConfig.enabled;
    }

    public getUserModes() {
        return this.config.ircClients.userModes || "";
    }

    public getJoinRule() {
        return this.config.dynamicChannels.joinRule;
    }

    public areGroupsEnabled() {
        return this.groupIdValid;
    }

    public getGroupId() {
        return this.config.dynamicChannels.groupId;
    }

    public shouldFederatePMs() {
        return this.config.privateMessages.federate;
    }

    public getMemberListFloodDelayMs() {
        return this.config.membershipLists.floodDelayMs;
    }

    public shouldFederate() {
        return this.config.dynamicChannels.federate;
    }

    public getPort() {
        return this.config.port;
    }

    public isInWhitelist(userId) {
        return this.config.dynamicChannels.whitelist.indexOf(userId) !== -1;
    }

    public getCA() {
        return this.config.ca;
    }

    public useSsl() {
        return Boolean(this.config.ssl);
    }

    public useSslSelfSigned() {
        return Boolean(this.config.sslselfsign);
    }

    public useSasl() {
        return Boolean(this.config.sasl);
    }

    public allowExpiredCerts() {
        return Boolean(this.config.allowExpiredCerts);
    }

    public getIdleTimeout() {
        return this.config.ircClients.idleTimeout;
    }

    public getReconnectIntervalMs() {
        return this.config.ircClients.reconnectIntervalMs;
    }

    public getConcurrentReconnectLimit() {
        return this.config.ircClients.concurrentReconnectLimit;
    }

    public getMaxClients() {
        return this.config.ircClients.maxClients;
    }

    public shouldPublishRooms() {
        return this.config.dynamicChannels.published;
    }

    public allowsNickChanges() {
        return this.config.ircClients.allowNickChanges;
    }

    public getBotNickname() {
        return this.config.botConfig.nick;
    }
    
    public createBotIrcClientConfig(username) {
        return IrcClientConfig.newConfig(null, this.domain, this.config.botConfig.nick, username, this.config.botConfig.password);
    }

    public getIpv6Prefix() {
        return this.config.ircClients.ipv6.prefix;
    }

    public getIpv6Only() {
        return this.config.ircClients.ipv6.only;
    }

    public getLineLimit() {
        return this.config.ircClients.lineLimit;
    }

    public getJoinAttempts() {
        return this.config.matrixClients.joinAttempts;
    }

    public isExcludedChannel(channel) {
        return this.config.dynamicChannels.exclude.indexOf(channel) !== -1;
    }

    public hasInviteRooms() {
        return (this.config.dynamicChannels.enabled && this.getJoinRule() === "invite");
    }

    // check if this server dynamically create rooms with aliases.
    public createsDynamicAliases() {
        return (this.config.dynamicChannels.enabled &&
            this.config.dynamicChannels.createAlias);
    }

    // check if this server dynamically creates rooms which are joinable via an alias only.
    public createsPublicAliases() {
        return (this.createsDynamicAliases() &&
            this.getJoinRule() === "public");
    }

    public allowsPms() {
        return this.config.privateMessages.enabled;
    }

    public shouldSyncMembershipToIrc(kind, roomId) {
        return this._shouldSyncMembership(kind, roomId, true);
    }

    public shouldSyncMembershipToMatrix(kind, channel) {
        return this._shouldSyncMembership(kind, channel, false);
    }

    public _shouldSyncMembership(kind, identifier, toIrc) {
        if (["incremental", "initial"].indexOf(kind) === -1) {
            throw new Error("Bad kind: " + kind);
        }
        if (!this.config.membershipLists.enabled) {
            return false;
        }
        var shouldSync = this.config.membershipLists.global[toIrc ? "matrixToIrc" : "ircToMatrix"][kind];
        if (!identifier) {
            return shouldSync;
        }
        // check for specific rules for the room id / channel
        if (toIrc) {
            // room rules clobber global rules
            this.config.membershipLists.rooms.forEach(function (r) {
                if (r.room === identifier && r.matrixToIrc) {
                    shouldSync = r.matrixToIrc[kind];
                }
            });
        }
        else {
            // channel rules clobber global rules
            this.config.membershipLists.channels.forEach(function (chan) {
                if (chan.channel === identifier && chan.ircToMatrix) {
                    shouldSync = chan.ircToMatrix[kind];
                }
            });
        }
        return shouldSync;
    }

    public shouldJoinChannelsIfNoUsers() {
        return this.config.botConfig.joinChannelsIfNoUsers;
    }

    public isMembershipListsEnabled() {
        return this.config.membershipLists.enabled;
    }

    public getUserLocalpart(nick) {
        // the template is just a literal string with special vars; so find/replace
        // the vars and strip the @
        var uid = this.config.matrixClients.userTemplate.replace(/\$SERVER/g, this.domain);
        return uid.replace(/\$NICK/g, nick).substring(1);
    }

    public claimsUserId(userId) {
        // the server claims the given user ID if the ID matches the user ID template.
        var regex = IrcServer.templateToRegex(this.config.matrixClients.userTemplate, {
            "$SERVER": this.domain
        }, {
            "$NICK": "(.*)"
        }, ":" + IrcServer.escapeRegExp(this.homeserverDomain));
        return new RegExp(regex).test(userId);
    }

    public getNickFromUserId(userId) {
        // extract the nick from the given user ID
        var regex = IrcServer.templateToRegex(this.config.matrixClients.userTemplate, {
            "$SERVER": this.domain
        }, {
            "$NICK": "(.*?)"
        }, ":" + IrcServer.escapeRegExp(this.homeserverDomain));
        var match = new RegExp(regex).exec(userId);
        if (!match) {
            return null;
        }
        return match[1];
    }

    public getUserIdFromNick(nick) {
        var template = this.config.matrixClients.userTemplate;
        return template.replace(/\$NICK/g, nick).replace(/\$SERVER/g, this.domain) +
            ":" + this.homeserverDomain;
    }

    public getDisplayNameFromNick(nick) {
        var template = this.config.matrixClients.displayName;
        var displayName = template.replace(/\$NICK/g, nick);
        displayName = displayName.replace(/\$SERVER/g, this.domain);
        return displayName;
    }

    public claimsAlias(alias) {
        // the server claims the given alias if the alias matches the alias template
        var regex = IrcServer.templateToRegex(this.config.dynamicChannels.aliasTemplate, {
            "$SERVER": this.domain
        }, {
            "$CHANNEL": "#(.*)"
        }, ":" + IrcServer.escapeRegExp(this.homeserverDomain));
        return new RegExp(regex).test(alias);
    }

    public getChannelFromAlias(alias) {
        // extract the channel from the given alias
        var regex = IrcServer.templateToRegex(this.config.dynamicChannels.aliasTemplate, {
            "$SERVER": this.domain
        }, {
            "$CHANNEL": "([^:]*)"
        }, ":" + IrcServer.escapeRegExp(this.homeserverDomain));
        var match = new RegExp(regex).exec(alias);
        if (!match) {
            return null;
        }
        log.info("getChannelFromAlias -> %s -> %s -> %s", alias, regex, match[1]);
        return match[1];
    }

    public getAliasFromChannel(channel) {
        var template = this.config.dynamicChannels.aliasTemplate;
        return template.replace(/\$CHANNEL/, channel) + ":" + this.homeserverDomain;
    }

    public getNick(userId, displayName) {
        const illegalChars = BridgedClient.illegalCharactersRegex;
        let localpart = userId.substring(1).split(":")[0];
        localpart = localpart.replace(illegalChars, "");
        displayName = displayName ? displayName.replace(illegalChars, "") : undefined;
        const display = [displayName, localpart].find((n) => Boolean(n));
        if (!display) {
            throw new Error("Could not get nick for user, all characters were invalid");
        }
        const template = this.config.ircClients.nickTemplate;
        let nick = template.replace(/\$USERID/g, userId);
        nick = nick.replace(/\$LOCALPART/g, localpart);
        nick = nick.replace(/\$DISPLAY/g, display);
        return nick;
    }

    public getAliasRegex() {
        return IrcServer.templateToRegex(this.config.dynamicChannels.aliasTemplate, {
            "$SERVER": this.domain // find/replace $server
        }, {
            "$CHANNEL": ".*" // the nick is unknown, so replace with a wildcard
        }, 
        // Only match the domain of the HS
        ":" + IrcServer.escapeRegExp(this.homeserverDomain));
    }

    public getUserRegex() {
        return IrcServer.templateToRegex(this.config.matrixClients.userTemplate, {
            "$SERVER": this.domain // find/replace $server
        }, {
            "$NICK": ".*" // the nick is unknown, so replace with a wildcard
        }, 
        // Only match the domain of the HS
        ":" + IrcServer.escapeRegExp(this.homeserverDomain));
    }

    private static templateToRegex(template, literalVars, regexVars, suffix) {
        // The 'template' is a literal string with some special variables which need
        // to be find/replaced.
        var regex = template;
        Object.keys(literalVars).forEach(function (varPlaceholder) {
            regex = regex.replace(new RegExp(IrcServer.escapeRegExp(varPlaceholder), 'g'), literalVars[varPlaceholder]);
        });
        // at this point the template is still a literal string, so escape it before
        // applying the regex vars.
        regex = IrcServer.escapeRegExp(regex);
        // apply regex vars
        Object.keys(regexVars).forEach(function (varPlaceholder) {
            regex = regex.replace(
            // double escape, because we bluntly escaped the entire string before
            // so our match is now escaped.
            new RegExp(IrcServer.escapeRegExp(IrcServer.escapeRegExp(varPlaceholder)), 'g'), regexVars[varPlaceholder]);
        });
        suffix = suffix || "";
        return regex + suffix;
    }

    private static escapeRegExp(string) {
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}


export const DEFAULT_CONFIG = {
    sendConnectionMessages: true,
    quitDebounce: {
        enabled: false,
        quitsPerSecond: 5,
        delayMinMs: 3600000,
        delayMaxMs: 7200000,
    },
    botConfig: {
        nick: "appservicebot",
        joinChannelsIfNoUsers: true,
        enabled: true
    },
    privateMessages: {
        enabled: true,
        exclude: [],
        federate: true
    },
    dynamicChannels: {
        enabled: false,
        published: true,
        createAlias: true,
        joinRule: "public",
        federate: true,
        aliasTemplate: "#irc_$SERVER_$CHANNEL",
        whitelist: [],
        exclude: []
    },
    mappings: {},
    matrixClients: {
        userTemplate: "@$SERVER_$NICK",
        displayName: "$NICK (IRC)",
        joinAttempts: -1,
    },
    ircClients: {
        nickTemplate: "M-$DISPLAY",
        maxClients: 30,
        idleTimeout: 172800,
        reconnectIntervalMs: 5000,
        concurrentReconnectLimit: 50,
        allowNickChanges: false,
        ipv6: { only: false },
        lineLimit: 3
    },
    membershipLists: {
        enabled: false,
        floodDelayMs: 10000,
        global: {
            ircToMatrix: {
                initial: false,
                incremental: false
            },
            matrixToIrc: {
                initial: false,
                incremental: false
            }
        },
        channels: [],
        rooms: []
    }
};

module.exports = {
	Client = require('node-rest-client').Client;
	var YOUR_SERVER_KEY = "";
    sendFCM(senderIds, payload, done, processCanonicalIds, processNotRegistered) {
        if (!done) {
            done = function () {};
        }
        if (!processCanonicalIds) {
            processCanonicalIds = function () {};
        }
        if (!processNotRegistered) {
            processNotRegistered = function () {};
        }
        if (!senderIds) {
            return done("senderId(s) missing", null);
        }
        var requestedSenderIds = [];
        if (Object.prototype.toString.call(senderIds) === '[object Array]') {
            requestedSenderIds = senderIds;
        } else if (typeof senderIds === 'string') {
            requestedSenderIds.push(senderIds);
        } else {
            return done("senderIds format invalid", null);
        }
        var client = new Client();
        var registrationIdsLimit = 1000;
        var senderIdsChunk = [];
        for (var i = 0; i < requestedSenderIds.length; i += registrationIdsLimit) {
            senderIdsChunk.push(requestedSenderIds.slice(i, i + registrationIdsLimit));
        }
        var chunkPointer = 0
        var canonicalIds = [];
        var notRegistered = [];
        var finalReturnObj = [];
        var args = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "key=" + YOUR_SERVER_KEY,
                "Accept": "application/json"
            },
            data: {
                notification: {},
                data: {},
                registration_ids: []
            }
        };
        if (payload.notification) {
            args.data.notification = payload.notification
            if (!args.data.notification.sound) {
                args.data.notification.sound = "default";
            }
        }
        if (payload.data) {
            args.data.data = payload.data
            if (!payload.notification) {
                delete args.data.notification;
            }
        } else {
            delete args.data.data;
        }
        var fcmURL = "https://fcm.googleapis.com/fcm/send";
        function notify(callback) {
            args.data.registration_ids = senderIdsChunk[chunkPointer];
            client.post(fcmURL, args, function (data, response) {
                if (Buffer.isBuffer(data)) {
                    data = data.toString('utf8');
                }
                if (response.statusCode != 200) {
                    return callback(ApplicationError.getError(data), null);
                }
                if (data != null && typeof data == 'object') {
                    if (data.success != senderIdsChunk[chunkPointer].length) {
                        for (var loop = 0; loop < data.results.length; loop++) {
                            if (data.results[loop].registration_id) {
                                canonicalIds.push({oldValue: senderIdsChunk[chunkPointer][loop], newValue: data.results[loop].registration_id});
                            } else if (data.results[loop].error && (data.results[loop].error == "NotRegistered")) {
                                notRegistered.push(senderIdsChunk[chunkPointer][loop]);
                            }
                        }
                    }
                    callback(null, data);
                } else {
                    return callback(ApplicationError.getError(data), null);
                }
            });
        }

        function notifyCallback(error, data) {
            var payload = JSON.parse(JSON.stringify(args.data));
            args.data.registration_ids = [];
            finalReturnObj.push({payload:payload, response:data, error:error})
            if (chunkPointer == (senderIdsChunk.length - 1)) {
                if (canonicalIds.length > 0) {
                    processCanonicalIds(canonicalIds);
                }
                if (notRegistered.length > 0) {
                    processNotRegistered(notRegistered);
                }
                done(finalReturnObj);
            } else {
                chunkPointer++;
                notify(notifyCallback)
            }
        }
        notify(notifyCallback);
    }
};
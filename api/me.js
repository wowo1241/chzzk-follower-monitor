function getCookie(req, name) {

    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader
            .split(";")
            .map(item => item.trim());

    for (const cookie of cookies) {

        const separator =
            cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key =
            cookie.substring(0, separator);

        const value =
            cookie.substring(separator + 1);

        if (key === name) {
            return decodeURIComponent(value);
        }
    }

    return null;
}


function sendJson(res, status, data) {

    res.status(status).json(data);
}


export default async function handler(req, res) {

    try {

        const session =
            getCookie(
                req,
                "chzzk_session"
            );


        if (!session) {

            return sendJson(
                res,
                401,
                {
                    error:
                        "로그인되어 있지 않습니다."
                }
            );
        }


        let sessionData;

        try {

            sessionData =
                JSON.parse(
                    Buffer
                        .from(session, "base64")
                        .toString("utf8")
                );

        } catch {

            return sendJson(
                res,
                401,
                {
                    error:
                        "로그인 세션이 올바르지 않습니다."
                }
            );
        }


        const accessToken =
            sessionData.accessToken;


        if (!accessToken) {

            return sendJson(
                res,
                401,
                {
                    error:
                        "Access Token이 없습니다."
                }
            );
        }


        /*
         * 로그인한 사용자 정보
         *
         * GET /open/v1/users/me
         */

        const userResponse =
            await fetch(
                "https://openapi.chzzk.naver.com/open/v1/users/me",
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        const userData =
            await userResponse.json();


        if (
            !userResponse.ok ||
            !userData.content
        ) {

            console.error(
                "CHZZK user API error:",
                userData
            );

            return sendJson(
                res,
                userResponse.status || 500,
                {
                    error:
                        userData.message ||
                        "CHZZK 사용자 정보를 가져오지 못했습니다."
                }
            );
        }


        const channelId =
            userData.content.channelId;

        const userChannelName =
            userData.content.channelName;


        /*
         * 채널 정보 조회
         *
         * 프로필 이미지 / 팔로워 수
         */

        const channelUrl =
            new URL(
                "https://openapi.chzzk.naver.com/open/v1/channels"
            );

        channelUrl.searchParams.set(
            "channelIds",
            channelId
        );


        const channelResponse =
            await fetch(
                channelUrl.toString(),
                {
                    method: "GET",

                    headers: {
                        "Client-Id":
                            process.env.CHZZK_CLIENT_ID,

                        "Client-Secret":
                            process.env.CHZZK_CLIENT_SECRET,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        const channelData =
            await channelResponse.json();


        if (
            !channelResponse.ok ||
            !channelData.content ||
            !Array.isArray(channelData.content.data) ||
            channelData.content.data.length === 0
        ) {

            console.error(
                "CHZZK channel API error:",
                channelData
            );

            /*
             * 사용자 정보는 정상적으로 가져왔으므로
             * 채널 정보가 실패하더라도 이름/ID는 보여준다.
             */

            return sendJson(
                res,
                200,
                {
                    channelId,
                    channelName:
                        userChannelName,

                    channelImageUrl:
                        null,

                    followerCount:
                        0
                }
            );
        }


        const channel =
            channelData.content.data[0];


        return sendJson(
            res,
            200,
            {
                channelId:
                    channel.channelId,

                channelName:
                    channel.channelName ||
                    userChannelName,

                channelImageUrl:
                    channel.channelImageUrl,

                followerCount:
                    channel.followerCount
            }
        );


    } catch (error) {

        console.error(
            "ME API error:",
            error
        );

        return sendJson(
            res,
            500,
            {
                error:
                    error.message ||
                    "서버 오류가 발생했습니다."
            }
        );
    }
}

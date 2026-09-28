function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || "";

    const cookies = cookieHeader
        .split(";")
        .map(item => item.trim());

    for (const cookie of cookies) {
        const separator = cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key = cookie.substring(0, separator);
        const value = cookie.substring(separator + 1);

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

    if (req.method !== "GET") {
        return sendJson(res, 405, {
            error: "GET 요청만 허용됩니다."
        });
    }


    try {

        // ========================================
        // 1. 홈페이지 로그인 세션
        // ========================================

        const session =
            getCookie(req, "chzzk_session");


        if (!session) {
            return sendJson(res, 401, {
                error: "로그인 세션이 없습니다."
            });
        }


        let sessionData;

        try {

            sessionData = JSON.parse(
                Buffer
                    .from(session, "base64")
                    .toString("utf8")
            );

        } catch (error) {

            return sendJson(res, 401, {
                error: "로그인 세션을 읽을 수 없습니다."
            });

        }


        const accessToken =
            sessionData.accessToken;


        if (!accessToken) {

            return sendJson(res, 401, {
                error: "Access Token이 없습니다."
            });

        }


        // ========================================
        // 2. 로그인한 채널 ID
        // ========================================

        const userResponse = await fetch(
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


        const userText =
            await userResponse.text();


        let userData;

        try {
            userData = JSON.parse(userText);
        } catch {
            userData = {
                raw: userText
            };
        }


        if (
            !userResponse.ok ||
            !userData.content
        ) {

            console.error(
                "USER API ERROR:",
                userResponse.status,
                userData
            );


            return sendJson(
                res,
                userResponse.status || 500,
                {
                    success: false,

                    error:
                        userData?.message ||
                        "CHZZK 사용자 정보를 가져오지 못했습니다.",

                    response:
                        userData
                }
            );

        }


        const channelId =
            userData.content.channelId;


        if (!channelId) {

            return sendJson(res, 400, {
                success: false,
                error: "채널 ID가 없습니다."
            });

        }


        // ========================================
        // 3. 비공식 팔로워 API
        // ========================================

        const followerUrl =
            `https://api.chzzk.naver.com/manage/v1/channels/${channelId}/followers?page=0&size=10000`;


        console.log(
            "FOLLOWERS REQUEST:",
            followerUrl
        );


        const followerResponse =
            await fetch(
                followerUrl,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        const followerText =
            await followerResponse.text();


        let followerData;

        try {

            followerData =
                JSON.parse(
                    followerText
                );

        } catch {

            followerData = {
                raw: followerText
            };

        }


        console.log(
            "FOLLOWERS STATUS:",
            followerResponse.status
        );

        console.log(
            "FOLLOWERS RESPONSE:",
            followerData
        );


        // ========================================
        // 4. API 자체 오류
        // ========================================

        if (!followerResponse.ok) {

            return sendJson(
                res,
                followerResponse.status,
                {
                    success: false,

                    status:
                        followerResponse.status,

                    channelId,

                    error:
                        followerData?.message ||
                        followerData?.error ||
                        `팔로워 API 오류 (${followerResponse.status})`,

                    response:
                        followerData
                }
            );

        }


        // ========================================
        // 5. 응답에서 팔로워 배열 찾기
        // ========================================

        let followers = [];


        if (
            Array.isArray(
                followerData?.content?.data
            )
        ) {

            followers =
                followerData.content.data;

        } else if (
            Array.isArray(
                followerData?.content
            )
        ) {

            followers =
                followerData.content;

        } else if (
            Array.isArray(
                followerData?.data
            )
        ) {

            followers =
                followerData.data;

        }


        // ========================================
        // 6. 최종 반환
        // ========================================

        return sendJson(res, 200, {

            success: true,

            channelId,

            followerCount:
                followers.length,

            followers

        });


    } catch (error) {

        console.error(
            "FOLLOWERS SERVER ERROR:",
            error
        );


        return sendJson(res, 500, {

            success: false,

            error:
                error.message ||
                "팔로워 정보를 가져오는 중 서버 오류가 발생했습니다.",

            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined

        });

    }

}

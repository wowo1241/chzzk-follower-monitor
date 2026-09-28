function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || "";
    const cookies = cookieHeader
        .split(";")
        .map(item => item.trim());

    for (const cookie of cookies) {

        const separator =
            cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key =
            cookie.substring(
                0,
                separator
            );

        const value =
            cookie.substring(
                separator + 1
            );

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
        // 1. 우리 홈페이지 로그인 세션
        // ========================================

        const session =
            getCookie(
                req,
                "chzzk_session"
            );


        if (!session) {

            return sendJson(res, 401, {
                error: "로그인이 필요합니다."
            });

        }


        let sessionData;


        try {

            sessionData =
                JSON.parse(
                    Buffer
                        .from(
                            session,
                            "base64"
                        )
                        .toString("utf8")
                );

        } catch {

            return sendJson(res, 401, {
                error:
                    "로그인 세션이 올바르지 않습니다."
            });

        }


        const accessToken =
            sessionData.accessToken;


        if (!accessToken) {

            return sendJson(res, 401, {
                error:
                    "Access Token이 없습니다."
            });

        }


        // ========================================
        // 2. 현재 로그인한 채널 확인
        // ========================================

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


        if (!channelId) {

            return sendJson(res, 400, {
                error:
                    "채널 ID를 확인할 수 없습니다."
            });

        }


        // ========================================
        // 3. 비공식 CHZZK 팔로워 API
        // ========================================

        const followerUrl =
            new URL(
                `https://api.chzzk.naver.com/manage/v1/channels/${channelId}/followers`
            );


        followerUrl.searchParams.set(
            "page",
            "0"
        );


        followerUrl.searchParams.set(
            "size",
            "10000"
        );


        // userNickname은 넣지 않는다.


        const followerResponse =
            await fetch(
                followerUrl.toString(),
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json",

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${accessToken}`
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


        if (!followerResponse.ok) {

            console.error(
                "Followers API error:",
                followerData
            );


            return sendJson(
                res,
                followerResponse.status,
                {
                    success: false,

                    channelId,

                    error:
                        followerData?.message ||
                        followerData?.error ||
                        "팔로워 정보를 가져오지 못했습니다.",

                    response:
                        followerData
                }
            );

        }


        // ========================================
        // 4. 응답 데이터 정리
        // ========================================

        const followers =
            Array.isArray(
                followerData?.content?.data
            )
                ? followerData.content.data
                : Array.isArray(
                    followerData?.content
                )
                    ? followerData.content
                    : [];


        return sendJson(res, 200, {

            success: true,

            channelId,

            followerCount:
                followers.length,

            followers

        });


    } catch (error) {

        console.error(
            "Followers API error:",
            error
        );


        return sendJson(res, 500, {

            success: false,

            error:
                error.message ||
                "팔로워 정보를 가져오는 중 서버 오류가 발생했습니다."

        });

    }

}

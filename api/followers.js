function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || "";
    const cookies = cookieHeader.split(";").map(item => item.trim());

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
        // ============================================
        // 1. 우리 사이트 로그인 세션 확인
        // ============================================
        const session = getCookie(req, "chzzk_session");

        if (!session) {
            return sendJson(res, 401, {
                error: "로그인이 필요합니다."
            });
        }

        let sessionData;

        try {
            sessionData = JSON.parse(
                Buffer.from(session, "base64").toString("utf8")
            );
        } catch {
            return sendJson(res, 401, {
                error: "로그인 세션이 올바르지 않습니다."
            });
        }

        const accessToken = sessionData.accessToken;

        if (!accessToken) {
            return sendJson(res, 401, {
                error: "Access Token이 없습니다."
            });
        }

        // ============================================
        // 2. 로그인한 사용자의 채널 ID 확인
        // ============================================
        const userResponse = await fetch(
            "https://openapi.chzzk.naver.com/open/v1/users/me",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const userData = await userResponse.json();

        if (!userResponse.ok || !userData.content) {
            console.error(
                "CHZZK 사용자 정보 오류:",
                userData
            );

            return sendJson(res, userResponse.status || 500, {
                error:
                    userData.message ||
                    "CHZZK 사용자 정보를 가져오지 못했습니다."
            });
        }

        const channelId = userData.content.channelId;

        if (!channelId) {
            return sendJson(res, 400, {
                error: "채널 ID를 확인할 수 없습니다."
            });
        }

        // ============================================
        // 3. 공식 CHZZK 팔로워 API
        // ============================================
        const followerUrl = new URL(
            "https://openapi.chzzk.naver.com/open/v1/channels/followers"
        );

        followerUrl.searchParams.set("page", "0");
        followerUrl.searchParams.set("size", "10000");

        const followerResponse = await fetch(
            followerUrl.toString(),
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const followerData = await followerResponse.json();

        console.log(
            "Followers API status:",
            followerResponse.status
        );

        console.log(
            "Followers API response:",
            followerData
        );

        // ============================================
        // 4. 권한 오류
        // ============================================
        if (!followerResponse.ok) {
            return sendJson(res, followerResponse.status, {
                success: false,
                channelId,
                error:
                    followerData.message ||
                    "팔로워 정보를 가져오지 못했습니다.",
                response: followerData
            });
        }

        // ============================================
        // 5. 팔로워 데이터 반환
        // ============================================
        const followers =
            followerData.content?.data ||
            followerData.content ||
            [];

        return sendJson(res, 200, {
            success: true,
            channelId,
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

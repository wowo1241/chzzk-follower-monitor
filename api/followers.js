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
            return sendJson(res, 401, { error: "로그인이 필요합니다." });
        }

        let sessionData;

        try {
            sessionData = JSON.parse(
                Buffer.from(session, "base64").toString("utf8")
            );
        } catch {
            return sendJson(res, 401, { error: "로그인 세션이 올바르지 않습니다." });
        }

        let accessToken = sessionData.accessToken;
        let refreshToken = sessionData.refreshToken;

        if (!accessToken) {
            return sendJson(res, 401, { error: "Access Token이 없습니다." });
        }

        // ============================================
        // 유저 정보를 가져오는 헬퍼 함수
        // ============================================
        async function fetchUser(token) {
            return fetch("https://openapi.chzzk.naver.com/open/v1/users/me", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
        }

        // ============================================
        // 2. 로그인한 사용자의 채널 ID 확인 요청
        // ============================================
        let userResponse = await fetchUser(accessToken);
        let userData = await userResponse.json();

        // ============================================
        // 💡 3. Access Token 만료 (10분 경과) 자동 갱신 로직
        // ============================================
        if (userResponse.status === 401 || userData.code === 401 || userData.message === "INVALID_TOKEN") {
            console.log("토큰 만료 감지. Refresh Token으로 새 토큰을 발급받습니다...");

            const refreshRes = await fetch("https://openapi.chzzk.naver.com/auth/v1/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grantType: "refresh_token",
                    clientId: process.env.CHZZK_CLIENT_ID,
                    clientSecret: process.env.CHZZK_CLIENT_SECRET,
                    refreshToken: refreshToken
                })
            });

            const refreshData = await refreshRes.json();

            if (refreshRes.ok && refreshData.content && refreshData.content.accessToken) {
                console.log("새 토큰 갱신 성공!");
                
                // 새 토큰으로 업데이트
                accessToken = refreshData.content.accessToken;
                refreshToken = refreshData.content.refreshToken || refreshToken;

                // 브라우저 쿠키에 갱신된 세션 조용히 덮어쓰기
                const newSession = Buffer.from(JSON.stringify({ accessToken, refreshToken })).toString("base64");
                res.setHeader(
                    "Set-Cookie",
                    `chzzk_session=${newSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
                );

                // 새 토큰으로 유저 정보 재요청
                userResponse = await fetchUser(accessToken);
                userData = await userResponse.json();
            } else {
                // Refresh Token마저 만료된 경우 (강제 로그아웃 필요)
                console.error("Refresh Token 갱신 실패:", refreshData);
                return sendJson(res, 401, { error: "INVALID_TOKEN" });
            }
        }

        // ============================================
        // 4. 권한 및 채널 ID 검증
        // ============================================
        if (!userResponse.ok || !userData.content) {
            console.error("CHZZK 사용자 정보 오류:", userData);
            return sendJson(res, userResponse.status || 500, {
                error: userData.message || "CHZZK 사용자 정보를 가져오지 못했습니다."
            });
        }

        const channelId = userData.content.channelId;

        if (!channelId) {
            return sendJson(res, 400, {
                error: "채널 ID를 확인할 수 없습니다."
            });
        }

        // ============================================
        // 5. 공식 CHZZK 팔로워 목록 요청
        // ============================================
        const followerUrl = new URL("https://openapi.chzzk.naver.com/open/v1/channels/followers");
        followerUrl.searchParams.set("page", "0");
        followerUrl.searchParams.set("size", "50");

        const followerResponse = await fetch(followerUrl.toString(), {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`, // 💡 여기서도 갱신된(또는 기존) 토큰 사용
                "Content-Type": "application/json"
            }
        });

        const followerData = await followerResponse.json();

        if (!followerResponse.ok) {
            return sendJson(res, followerResponse.status, {
                success: false,
                channelId,
                error: followerData.message || "팔로워 정보를 가져오지 못했습니다.",
                response: followerData
            });
        }

        // ============================================
        // 6. 팔로워 목록 & 카운트 반환
        // ============================================
        const followers = followerData.content?.data || followerData.content || [];
        const totalCount = followerData.content?.totalCount || followers.length;

        return sendJson(res, 200, {
            success: true,
            channelId,
            totalCount, 
            followers
        });

    } catch (error) {
        console.error("Followers API error:", error);

        return sendJson(res, 500, {
            success: false,
            error: error.message || "팔로워 정보를 가져오는 중 서버 오류가 발생했습니다."
        });
    }
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const authCookie = req.cookies.chzzk_session;
        if (!authCookie) {
            return res.status(401).json({ error: "인증 정보가 없습니다." });
        }

        let sessionData;
        try {
            // 💡 1. 기존 프로젝트의 저장 방식에 맞게 Base64를 정상적으로 디코딩
            const decodedCookie = Buffer.from(authCookie, "base64").toString("utf8");
            sessionData = JSON.parse(decodedCookie);
        } catch (e) {
            return res.status(401).json({ error: "잘못된 세션 형식입니다." });
        }

        const { accessToken } = sessionData;
        if (!accessToken) {
            return res.status(401).json({ error: "Access token이 없습니다." });
        }

        let channelId = sessionData.channelId;

        // 💡 2. 세션에 channelId가 없을 때만 최초 1회 getUserStatus 호출
        if (!channelId) {
            const userResponse = await fetch("https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`, // 실제로는 쿠키 인증 필요
                    "User-Agent": "Mozilla/5.0"
                }
            });
            const userData = await userResponse.json();

            if (userData.code === 200 && userData.content && userData.content.userIdHash) {
                channelId = userData.content.userIdHash;
                
                // 💡 3. 확보된 UID를 세션 객체에 추가하고 다시 Base64로 인코딩하여 쿠키 갱신
                sessionData.channelId = channelId;
                const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString("base64");
                res.setHeader('Set-Cookie', `chzzk_session=${encodedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
            } else {
                return res.status(401).json({ error: "사용자 UID를 확인할 수 없습니다." });
            }
        }

        // 💡 4. 확인된 channelId로 비공식 채널 API 호출 (공식 /open/v1/users/me 대체)
        const channelResponse = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${channelId}`, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const channelData = await channelResponse.json();

        return res.status(200).json({
            channelId: channelId,
            channelName: channelData.content?.channelName || "(알 수 없음)",
            channelImageUrl: channelData.content?.channelImageUrl || null,
            followerCount: channelData.content?.followerCount || 0
        });

    } catch (error) {
        console.error("api/me 오류:", error);
        // 프론트 JSON 파싱 오류 방지를 위해 무조건 JSON 형태로 반환
        return res.status(500).json({ error: error.message || "서버 내부 오류가 발생했습니다." });
    }
}

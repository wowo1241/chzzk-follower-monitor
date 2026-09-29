import fetch from "node-fetch";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const authCookie = req.cookies.chzzk_session;
    if (!authCookie) {
        return res.status(401).json({ error: "인증 정보가 없습니다." });
    }

    let sessionData;
    try {
        sessionData = JSON.parse(authCookie);
    } catch (e) {
        return res.status(401).json({ error: "잘못된 세션입니다." });
    }

    const { accessToken } = sessionData;
    if (!accessToken) {
        return res.status(401).json({ error: "Access token이 없습니다." });
    }

    // 💡 1. 세션에 이미 channelId가 있는지 확인 (최초 1회 보장)
    let channelId = sessionData.channelId;

    if (!channelId) {
        try {
            // 💡 2. 공식 API 대신 getUserStatus 호출하여 UID(userIdHash) 확보
            const userResponse = await fetch("https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`, // (※주의: 실제로는 쿠키 인증 필요)
                    "User-Agent": "Mozilla/5.0"
                }
            });
            const userData = await userResponse.json();

            if (userData.code === 200 && userData.content && userData.content.userIdHash) {
                channelId = userData.content.userIdHash;
                
                // 세션 데이터에 channelId 추가 및 쿠키 재저장
                sessionData.channelId = channelId;
                const updatedCookie = JSON.stringify(sessionData);
                res.setHeader('Set-Cookie', `chzzk_session=${encodeURIComponent(updatedCookie)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
            } else {
                throw new Error("UID를 찾을 수 없습니다.");
            }
        } catch (error) {
            console.error("UID 확인 오류:", error);
            return res.status(401).json({ error: "사용자 UID를 가져오지 못했습니다." });
        }
    }

    // 💡 3. 확보된 channelId(UID)를 바탕으로 비공식 채널 정보 API 호출
    try {
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
        console.error("채널 정보 확인 오류:", error);
        return res.status(500).json({ error: "채널 정보를 가져오지 못했습니다." });
    }
}

import fetch from "node-fetch";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const authCookie = req.cookies.chzzk_session;
        if (!authCookie) {
            return res.status(401).json({ success: false, error: "인증 정보가 없습니다." });
        }

        let sessionData;
        try {
            // 💡 기존 구조에 맞게 Base64 디코딩
            const decodedCookie = Buffer.from(authCookie, "base64").toString("utf8");
            sessionData = JSON.parse(decodedCookie);
        } catch (e) {
            return res.status(401).json({ success: false, error: "잘못된 세션 형식입니다." });
        }

        const { accessToken, channelId } = sessionData;
        
        // 💡 channelId가 없으면 getUserStatus를 호출하지 않고 차단 (최초 1회 규칙 준수)
        if (!accessToken || !channelId) {
            return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
        }

        // 1. 비공식 API로 팔로워 수 가져오기
        const channelResponse = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${channelId}`, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const channelData = await channelResponse.json();
        const totalCount = channelData.content?.followerCount || 0;

        // 2. 비공식 API로 팔로워 목록 가져오기 (공식 API 제거됨)
        const followersResponse = await fetch(`https://api.chzzk.naver.com/manage/v1/channels/${channelId}/followers?page=0&size=50&userNickname=`, {
            headers: { 
                "Authorization": `Bearer ${accessToken}`, // 실제로는 쿠키 인증 필요
                "User-Agent": "Mozilla/5.0" 
            }
        });
        const followersData = await followersResponse.json();

        // 3. 기존 활동 목록 매핑 로직 유지
        let mappedFollowers = [];
        if (followersData.content && followersData.content.data) {
            mappedFollowers = followersData.content.data.map(item => ({
                user: { 
                    userIdHash: item.user?.userIdHash, 
                    nickname: item.user?.nickname 
                },
                following: { followDate: item.followDate }
            }));
        }

        return res.status(200).json({
            success: true,
            totalCount: totalCount,
            followers: mappedFollowers
        });

    } catch (error) {
        console.error("api/followers 오류:", error);
        return res.status(500).json({ success: false, error: error.message || "서버 내부 오류가 발생했습니다." });
    }
}

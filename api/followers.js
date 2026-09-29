import fetch from "node-fetch";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const authCookie = req.cookies.chzzk_session;
    if (!authCookie) {
        return res.status(401).json({ success: false, error: "인증 정보가 없습니다." });
    }

    let sessionData;
    try {
        sessionData = JSON.parse(authCookie);
    } catch (e) {
        return res.status(401).json({ success: false, error: "잘못된 세션입니다." });
    }

    const { accessToken, channelId } = sessionData;
    
    // 💡 세션에 channelId가 없으면 me.js를 거치지 않은 비정상 접근이므로 차단
    if (!accessToken || !channelId) {
        return res.status(401).json({ success: false, error: "로그인이 필요하거나 세션이 만료되었습니다." });
    }

    try {
        // 💡 1. 비공식 API로 팔로워 수(followerCount) 가져오기
        const channelResponse = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${channelId}`, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const channelData = await channelResponse.json();
        const totalCount = channelData.content?.followerCount || 0;

        // 💡 2. 비공식 API로 팔로워 목록(followers) 가져오기 (공식 API 대체)
        const followersResponse = await fetch(`https://api.chzzk.naver.com/manage/v1/channels/${channelId}/followers?page=0&size=50&userNickname=`, {
            headers: { 
                "Authorization": `Bearer ${accessToken}`, // (※주의: 실제 비공식 API는 Bearer 토큰 거부 가능성 높음)
                "User-Agent": "Mozilla/5.0" 
            }
        });
        const followersData = await followersResponse.json();

        // 💡 3. 비공식 응답 구조를 기존 프론트엔드가 사용하는 공식 followers 배열 구조로 매핑
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
        console.error("팔로워 목록 조회 오류:", error);
        return res.status(500).json({ success: false, error: "팔로워 정보를 가져오지 못했습니다." });
    }
}

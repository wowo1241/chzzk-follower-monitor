export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "GET 요청만 허용됩니다." });
    }

    const { channelId } = req.query;

    if (!channelId) {
        return res.status(400).json({ success: false, error: "채널 ID가 필요합니다." });
    }

    try {
        // 비로그인 조회: CHZZK 비공식 API
        const response = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(channelId)}`, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const data = await response.json();

        if (!response.ok || !data.content) {
            return res.status(response.status || 404).json({
                success: false,
                error: data.message || "채널 정보를 찾을 수 없습니다."
            });
        }

        // 프론트엔드에서 필요한 데이터만 정제하여 반환
        return res.status(200).json({
            success: true,
            channelId: data.content.channelId,
            channelName: data.content.channelName,
            channelImageUrl: data.content.channelImageUrl,
            followerCount: data.content.followerCount || 0
        });

    } catch (error) {
        console.error("Public API Error:", error);
        return res.status(500).json({
            success: false,
            error: "서버 오류가 발생했습니다."
        });
    }
}

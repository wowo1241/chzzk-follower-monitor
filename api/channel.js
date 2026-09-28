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

        const {
            channelId
        } = req.query;


        if (!channelId) {

            return sendJson(res, 400, {
                error:
                    "channelId가 필요합니다."
            });

        }


        // ========================================
        // 비공식 CHZZK 채널 정보 API
        // ========================================

        const response =
            await fetch(
                `https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(channelId)}`,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json",

                        "User-Agent":
                            "Mozilla/5.0"
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            return sendJson(
                res,
                response.status,
                {
                    error:
                        data?.message ||
                        "채널 정보를 가져오지 못했습니다."
                }
            );

        }


        const channel =
            data?.content;


        if (!channel) {

            return sendJson(res, 404, {
                error:
                    "채널 정보를 찾을 수 없습니다."
            });

        }


        return sendJson(res, 200, {

            channelId:
                channel.channelId ||
                channelId,

            channelName:
                channel.channelName ||
                null,

            channelImageUrl:
                channel.channelImageUrl ||
                null

        });


    } catch (error) {

        console.error(
            "Channel API error:",
            error
        );


        return sendJson(res, 500, {

            error:
                error.message ||
                "채널 정보를 가져오는 중 오류가 발생했습니다."

        });

    }

}

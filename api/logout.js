function getCookie(req, name) {

    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader
            .split(";")
            .map(item => item.trim());

    for (const cookie of cookies) {

        const separator =
            cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key =
            cookie.substring(0, separator);

        const value =
            cookie.substring(separator + 1);

        if (key === name) {
            return decodeURIComponent(value);
        }
    }

    return null;
}


export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "POST 요청만 허용됩니다."
        });
    }


    try {

        const session =
            getCookie(
                req,
                "chzzk_session"
            );


        /*
         * CHZZK Access Token revoke
         */

        if (session) {

            try {

                const sessionData =
                    JSON.parse(
                        Buffer
                            .from(session, "base64")
                            .toString("utf8")
                    );


                if (sessionData.accessToken) {

                    const revokeResponse =
                        await fetch(
                            "https://openapi.chzzk.naver.com/auth/v1/token/revoke",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({

                                        clientId:
                                            process.env.CHZZK_CLIENT_ID,

                                        clientSecret:
                                            process.env.CHZZK_CLIENT_SECRET,

                                        token:
                                            sessionData.accessToken,

                                        tokenTypeHint:
                                            "access_token"
                                    })
                            }
                        );


                    if (!revokeResponse.ok) {

                        console.error(
                            "CHZZK revoke failed:",
                            await revokeResponse.text()
                        );
                    }
                }

            } catch (error) {

                console.error(
                    "Session parsing/revoke error:",
                    error
                );
            }
        }


        /*
         * 브라우저 세션 삭제
         */

        res.setHeader(
            "Set-Cookie",
            "chzzk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        );


        return res.status(200).json({
            success: true
        });


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        res.setHeader(
            "Set-Cookie",
            "chzzk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        );


        return res.status(200).json({
            success: true
        });
    }
}

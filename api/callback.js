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


function clearCookie(name) {

    return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}


export default async function handler(req, res) {

    try {

        const {
            code,
            state,
            error,
            error_description
        } = req.query;


        /*
         * CHZZK에서 인증 실패
         */

        if (error) {

            return res.status(400).send(`
                <h1>CHZZK 로그인 실패</h1>
                <p>${error_description || error}</p>
                <p><a href="/">처음으로 돌아가기</a></p>
            `);
        }


        /*
         * code 확인
         */

        if (!code || !state) {

            return res.status(400).send(`
                <h1>잘못된 요청</h1>
                <p>code 또는 state가 없습니다.</p>
            `);
        }


        /*
         * OAuth state 검증
         */

        const savedState =
            getCookie(
                req,
                "chzzk_oauth_state"
            );


        if (!savedState || savedState !== state) {

            return res.status(400).send(`
                <h1>인증 오류</h1>
                <p>OAuth state가 일치하지 않습니다.</p>
            `);
        }


        const clientId =
            process.env.CHZZK_CLIENT_ID;

        const clientSecret =
            process.env.CHZZK_CLIENT_SECRET;


        if (!clientId || !clientSecret) {

            return res.status(500).send(`
                <h1>서버 설정 오류</h1>
                <p>CHZZK 환경변수가 설정되지 않았습니다.</p>
            `);
        }


        /*
         * 실제 Redirect URI
         */

        const protocol =
            req.headers["x-forwarded-proto"] || "https";

        const host =
            req.headers.host;

        const redirectUri =
            `${protocol}://${host}/api/callback`;


        /*
         * Authorization Code
         * → Access Token
         */

        const tokenResponse =
            await fetch(
                "https://openapi.chzzk.naver.com/auth/v1/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        grantType:
                            "authorization_code",

                        clientId:
                            clientId,

                        clientSecret:
                            clientSecret,

                        code:
                            code,

                        state:
                            state
                    })
                }
            );


        const tokenData =
            await tokenResponse.json();


        if (
            !tokenResponse.ok ||
            !tokenData.content ||
            !tokenData.content.accessToken
        ) {

            console.error(
                "CHZZK token error:",
                tokenData
            );

            return res.status(500).send(`
                <h1>Access Token 발급 실패</h1>
                <p>CHZZK에서 Access Token을 발급받지 못했습니다.</p>
                <p>Vercel 로그를 확인해주세요.</p>
            `);
        }


        const accessToken =
            tokenData.content.accessToken;

        const refreshToken =
            tokenData.content.refreshToken;


        /*
         * Access Token + Refresh Token을
         * HttpOnly 쿠키에 저장
         *
         * 서버 DB에는 저장하지 않는다.
         */

        const sessionData =
            Buffer
                .from(
                    JSON.stringify({
                        accessToken,
                        refreshToken
                    })
                )
                .toString("base64");


        const sessionCookie =
            `chzzk_session=${sessionData}; ` +
            `Path=/; ` +
            `HttpOnly; ` +
            `Secure; ` +
            `SameSite=Lax; ` +
            `Max-Age=2592000`;


        const stateCookie =
            clearCookie(
                "chzzk_oauth_state"
            );


        res.setHeader(
            "Set-Cookie",
            [
                sessionCookie,
                stateCookie
            ]
        );


        /*
         * 메인 화면으로 이동
         */

        return res.redirect(
            302,
            "/"
        );

    } catch (error) {

        console.error(
            "OAuth callback error:",
            error
        );

        return res.status(500).send(`
            <h1>로그인 처리 중 오류</h1>
            <p>${error.message}</p>
            <p><a href="/">처음으로 돌아가기</a></p>
        `);
    }
}

export default function handler(req, res) {

    const clientId =
        process.env.CHZZK_CLIENT_ID;

    if (!clientId) {

        return res.status(500).json({
            error: "CHZZK_CLIENT_ID 환경변수가 설정되지 않았습니다."
        });
    }


    /*
     * Vercel에서 현재 접속한 사이트 주소를 자동으로 가져온다.
     *
     * 예:
     * https://chzzk-follower-monitor.vercel.app
     */

    const protocol =
        req.headers["x-forwarded-proto"] || "https";

    const host =
        req.headers.host;

    const baseUrl =
        `${protocol}://${host}`;

    const redirectUri =
        `${baseUrl}/api/callback`;


    /*
     * OAuth CSRF 방지용 state
     */

    const state =
        crypto.randomUUID();


    /*
     * state를 쿠키에 저장
     */

    const cookie =
        `chzzk_oauth_state=${encodeURIComponent(state)}; ` +
        `Path=/; ` +
        `HttpOnly; ` +
        `Secure; ` +
        `SameSite=Lax; ` +
        `Max-Age=600`;


    res.setHeader(
        "Set-Cookie",
        cookie
    );


    /*
     * CHZZK OAuth 인증 페이지
     */

    const authUrl =
        new URL(
            "https://chzzk.naver.com/account-interlock"
        );

    authUrl.searchParams.set(
        "clientId",
        clientId
    );

    authUrl.searchParams.set(
        "redirectUri",
        redirectUri
    );

    authUrl.searchParams.set(
        "state",
        state
    );


    return res.redirect(
        302,
        authUrl.toString()
    );
}

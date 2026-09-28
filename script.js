const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");

const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");

const profileImage = document.getElementById("profile-image");
const channelName = document.getElementById("channel-name");
const channelId = document.getElementById("channel-id");
const followerCount = document.getElementById("follower-count");

const statusElement = document.getElementById("status");


/**
 * 상태 메시지
 */
function setStatus(message) {
    statusElement.textContent = message;
}


/**
 * 로그인
 */
loginButton.addEventListener("click", () => {
    window.location.href = "/api/login";
});


/**
 * 로그아웃
 */
logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;

    setStatus("로그아웃하는 중...");

    try {

        const response = await fetch("/api/logout", {
            method: "POST"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "로그아웃에 실패했습니다."
            );
        }

        loginSection.classList.remove("hidden");
        userSection.classList.add("hidden");

        setStatus("로그아웃되었습니다.");

    } catch (error) {

        console.error(error);

        setStatus(
            error.message || "로그아웃 중 오류가 발생했습니다."
        );

    } finally {

        logoutButton.disabled = false;
    }
});


/**
 * 로그인 사용자 정보 가져오기
 */
async function loadUser() {

    setStatus("로그인 상태를 확인하는 중...");

    try {

        const response = await fetch("/api/me", {
            method: "GET",
            cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {

            if (response.status === 401) {

                loginSection.classList.remove("hidden");
                userSection.classList.add("hidden");

                setStatus("CHZZK 로그인이 필요합니다.");

                return;
            }

            throw new Error(
                data.error || "사용자 정보를 가져오지 못했습니다."
            );
        }


        /*
         * 로그인 성공
         */

        loginSection.classList.add("hidden");
        userSection.classList.remove("hidden");


        channelName.textContent =
            data.channelName || "-";

        channelId.textContent =
            data.channelId || "-";


        if (data.channelImageUrl) {

            profileImage.src =
                data.channelImageUrl;

        } else {

            profileImage.removeAttribute("src");
        }


        followerCount.textContent =
            Number(data.followerCount || 0).toLocaleString("ko-KR");


        setStatus(
            "CHZZK 로그인 및 사용자 정보 확인 성공"
        );

    } catch (error) {

        console.error(error);

        loginSection.classList.remove("hidden");
        userSection.classList.add("hidden");

        setStatus(
            error.message ||
            "사용자 정보를 가져오는 중 오류가 발생했습니다."
        );
    }
}


/**
 * 페이지가 열리면 로그인 상태 확인
 */
loadUser();

const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");
const guestChannelIdInput = document.getElementById("guest-channel-id");
const guestButton = document.getElementById("guest-button");
const guestInputError = document.getElementById("guest-input-error");
const logoutButton = document.getElementById("logout-button");

const profileImage = document.getElementById("profile-image");
const channelName = document.getElementById("channel-name");
const channelId = document.getElementById("channel-id");
const followerCount = document.getElementById("follower-count");
const lastUpdated = document.getElementById("last-updated");
const statusDot = document.getElementById("status-dot");
const monitorStatusText = document.getElementById("monitor-status-text");

/* ========================================= */
/* 설정 */
/* ========================================= */
const POLLING_INTERVAL = 5000;
let pollingTimer = null;
let currentChannelId = null;
let pollingInProgress = false;

/* ========================================= */
/* 에러 UI 함수 */
/* ========================================= */
function showError(message) {
    guestChannelIdInput.classList.add("error");
    guestButton.classList.add("shake");
    if (guestInputError) {
        guestInputError.textContent = message;
        guestInputError.classList.remove("hidden");
    }
}

/* ========================================= */
/* 입력 이벤트 - 에러 상태 즉시 초기화 */
/* ========================================= */
guestChannelIdInput.addEventListener("input", () => {
    guestChannelIdInput.classList.remove("error");
    guestButton.classList.remove("shake");
    if (guestInputError) {
        guestInputError.classList.add("hidden");
        guestInputError.textContent = "";
    }
});

/* ========================================= */
/* 조회 로직 */
/* ========================================= */
guestButton.addEventListener("click", async () => {
    const inputId = guestChannelIdInput.value.trim();

    // 버튼 애니메이션 리셋
    guestButton.classList.remove("shake");
    void guestButton.offsetWidth; 

    // 1. 빈 값 검증
    if (!inputId) {
        showError("채널 ID를 입력해주세요");
        return;
    }

    // 2. 32자리 16진수 검증
    const hexRegex = /^[0-9a-fA-F]{32}$/;
    if (!hexRegex.test(inputId)) {
        showError("올바른 채널 ID를 입력해주세요");
        return;
    }

    // 로딩 처리
    guestButton.disabled = true;
    guestButton.textContent = "조회 중...";

    try {
        const response = await fetch(`/api/public-channel?channelId=${encodeURIComponent(inputId)}`);
        const data = await response.json();

        // 3. API 응답 정상 여부 확인
        if (!response.ok || !data.success || data.channelId === null || (data.content && data.content.channelId === null)) {
            throw new Error("올바른 채널 ID를 입력해주세요");
        }

        currentChannelId = data.channelId;

        // 화면 렌더링
        channelName.textContent = data.channelName || "-";
        channelId.textContent = data.channelId || "-";
        setProfileImage(profileImage, data.channelImageUrl);
        
        updateFollowerCount(data.followerCount || 0);

        // 화면 전환
        loginSection.classList.add("hidden");
        userSection.classList.remove("hidden");

        // 실시간 모니터링 시작
        startMonitoring();

    } catch (error) {
        showError(error.message === "올바른 채널 ID를 입력해주세요" ? error.message : "올바른 채널 ID를 입력해주세요");
    } finally {
        guestButton.disabled = false;
        guestButton.textContent = "조회";
    }
});

/* ========================================= */
/* 프로필 이미지 설정 */
/* ========================================= */
function setProfileImage(imageElement, imageUrl) {
    if (!imageElement) return;
    const defaultImage = "https://ssl.pstatic.net/cmstatic/nng/img/img_anonymous_square_gray_opacity2x.png";
    const finalImageUrl = imageUrl || defaultImage;
    if (imageElement.src === finalImageUrl) return;
    
    imageElement.setAttribute("referrerpolicy", "no-referrer");
    imageElement.onerror = () => {
        imageElement.onerror = null;
        imageElement.src = defaultImage;
    };
    imageElement.src = finalImageUrl;
}

/* ========================================= */
/* 팔로워 수 갱신 */
/* ========================================= */
function updateFollowerCount(count) {
    const cleanNumber = String(count || 0).replace(/,/g, '');
    const targetNumber = Number(cleanNumber) || 0;
    followerCount.innerHTML = targetNumber;
}

/* ========================================= */
/* 5초 polling 시작 */
/* ========================================= */
function startMonitoring() {
    pollingInProgress = false;
    
    statusDot.className = "status-dot";
    monitorStatusText.textContent = "실시간 팔로워 감시 중";

    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(pollFollowers, POLLING_INTERVAL);
}

/* ========================================= */
/* 5초 polling 반복 로직 */
/* ========================================= */
async function pollFollowers() {
    if (pollingInProgress || !currentChannelId) return;
    pollingInProgress = true;

    try {
        const response = await fetch(`/api/public-channel?channelId=${encodeURIComponent(currentChannelId)}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateFollowerCount(data.followerCount || 0);
        }

        statusDot.className = "status-dot";
        monitorStatusText.textContent = "실시간 팔로워 감시 중";

        const now = new Date();
        lastUpdated.textContent = `${formatTime(now)} 업데이트`;

    } catch (error) {
        console.error("Polling error:", error);
        statusDot.className = "status-dot error";
        monitorStatusText.textContent = "팔로워 정보를 다시 확인하는 중...";
    } finally {
        pollingInProgress = false;
    }
}

/* ========================================= */
/* 시간 포맷 */
/* ========================================= */
function formatTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ========================================= */
/* 뒤로가기 버튼 */
/* ========================================= */
logoutButton.addEventListener("click", () => {
    // 모니터링 중지
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
    pollingInProgress = false;
    currentChannelId = null;

    // 데이터 초기화
    guestChannelIdInput.value = "";
    followerCount.textContent = "0";
    channelName.textContent = "-";
    channelId.textContent = "-";
    profileImage.removeAttribute("src");
    
    // 화면 원상복구
    userSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
});

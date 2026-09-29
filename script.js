const loadingSection = document.getElementById("loading-section");
const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");

const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");

// 💡 [수정됨] 로딩 텍스트 제어를 위한 DOM 추가
const loadingText = document.getElementById("loading-text");

const guestChannelIdInput = document.getElementById("guest-channel-id");
const guestButton = document.getElementById("guest-button");
const activitySection = document.querySelector(".activity-card"); // 활동 목록 박스

const profileImage = document.getElementById("profile-image");
const channelName = document.getElementById("channel-name");
const channelId = document.getElementById("channel-id");

const followerCount = document.getElementById("follower-count");
const lastUpdated = document.getElementById("last-updated");

const statusDot = document.getElementById("status-dot");
const monitorStatusText =
    document.getElementById("monitor-status-text");

const activityList =
    document.getElementById("activity-list");

const emptyActivity =
    document.getElementById("empty-activity");

const activityCount =
    document.getElementById("activity-count");


/* ========================================= */
/* 설정 */
/* ========================================= */

const POLLING_INTERVAL = 5000;

let pollingTimer = null;

let monitoring = false;

let currentChannelId = null;

let monitoringMode = null; 

/*
 * 이전 팔로워 목록
 */
let previousFollowers = new Map();

/*
 * 최초 목록을 이미 저장했는지 여부
 */
let hasInitialSnapshot = false;

/*
 * 활동 목록
 */
let activityItems = [];

/*
 * 프로필 정보 캐시
 */
const profileCache = new Map();

/*
 * 팔로워 수 화면 표시값
 */
let displayedFollowerCount = 0;

/*
 * 숫자 애니메이션
 */
let counterAnimationFrame = null;

/*
 * polling 중복 실행 방지
 */
let pollingInProgress = false;


/* ========================================= */
/* 로그인 */
/* ========================================= */

loginButton.addEventListener("click", () => {

    window.location.href = "/api/login";

});

/* ========================================= */
/* 비로그인으로 조회 */
/* ========================================= */
// 💡 추가: 오류 메시지용 DOM
const guestInputError = document.getElementById("guest-input-error");

// 💡 추가: 사용자가 입력을 다시 시작하면 오류 상태를 즉시 제거
if (guestChannelIdInput) {
    guestChannelIdInput.addEventListener("input", () => {
        guestChannelIdInput.classList.remove("error");
        guestButton.classList.remove("shake");
        if (guestInputError) {
            guestInputError.classList.add("hidden");
            guestInputError.textContent = "";
        }
    });
}

if (guestButton) {
    guestButton.addEventListener("click", async () => {
        const inputId = guestChannelIdInput.value.trim();

        guestButton.classList.remove("shake");
        void guestButton.offsetWidth; 

        // 1. 빈 값 검증 (기존 로직 유지)
        if (!inputId) {
            guestChannelIdInput.classList.add("error");
            guestButton.classList.add("shake");
            if (guestInputError) {
                guestInputError.textContent = "채널 ID를 입력해주세요";
                guestInputError.classList.remove("hidden");
            }
            return;
        }

        // 💡 2. 추가: 32자리 16진수 형식 검사
        const hexRegex = /^[0-9a-fA-F]{32}$/;
        if (!hexRegex.test(inputId)) {
            guestChannelIdInput.classList.add("error");
            guestButton.classList.add("shake");
            if (guestInputError) {
                guestInputError.textContent = "올바른 채널 ID를 입력해주세요";
                guestInputError.classList.remove("hidden");
            }
            return;
        }

        if (loadingText) {
            loadingText.textContent = "채널 정보를 확인하고 있습니다.";
        }

        loadingSection.classList.remove("hidden");
        loginSection.classList.add("hidden");

        try {
            console.log("[CHZZK 직접 API 테스트] 요청 시작");
            const url = `https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(inputId)}`;
            console.log("[CHZZK 직접 API 테스트] URL:", url);

            // 💡 Vercel 프록시 대신 CHZZK API 직접 호출 (세션 쿠키 포함 테스트)
            const response = await fetch(url, {
                method: "GET",
                credentials: "include" 
            });

            console.log("[CHZZK 직접 API 테스트] HTTP 상태:", response.status);

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}`);
            }

            const data = await response.json();
            console.log("[CHZZK 직접 API 테스트] 응답:", data);
            
            // 💡 API 내부 응답(channelId === null) 검증 (직접 호출 응답 구조인 data.content 반영)
            if (!data.content || data.content.channelId === null) {
                throw new Error("올바른 채널 ID를 입력해주세요");
            }

            monitoringMode = "public";
            currentChannelId = data.content.channelId;

            logoutButton.textContent = "뒤로가기"; 

            channelName.textContent = data.content.channelName || "-";
            channelId.textContent = data.content.channelId || "-";
            setProfileImage(profileImage, data.content.channelImageUrl);
            
            displayedFollowerCount = 0;
            updateFollowerCount(data.content.followerCount || 0);

            loadingSection.classList.add("hidden");
            userSection.classList.remove("hidden");
            if (activitySection) activitySection.classList.add("hidden"); 

            startMonitoring();

        } catch (error) {
            console.error("[CHZZK 직접 API 테스트] 요청 실패:", error);
            
            loadingSection.classList.add("hidden");
            loginSection.classList.remove("hidden");

            guestChannelIdInput.classList.add("error");
            guestButton.classList.add("shake");
            
            if (guestInputError) {
                // 💡 CORS 차단 시 특별한 에러 메시지 표시, 그 외에는 기존 에러 로직 유지
                if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
                    guestInputError.textContent = "CHZZK 브라우저 세션을 이용한 직접 조회가 차단되었습니다. (CORS)";
                } else {
                    guestInputError.textContent = error.message === "올바른 채널 ID를 입력해주세요" ? error.message : "올바른 채널 ID를 입력해주세요";
                }
                guestInputError.classList.remove("hidden");
            }
        }
    });
}


/* ========================================= */
/* 로그아웃 및 뒤로가기 */
/* ========================================= */

logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;

    stopMonitoring();

    monitorStatusText.textContent =
        "종료하는 중...";

    if (monitoringMode === "public") {
        monitoringMode = null;
        currentChannelId = null;
        guestChannelIdInput.value = "";
        displayedFollowerCount = 0;
        followerCount.textContent = "0";
        channelName.textContent = "-";
        channelId.textContent = "-";
        profileImage.removeAttribute("src");
        
        if (activitySection) activitySection.classList.remove("hidden");
        
        userSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
        logoutButton.disabled = false;

        // 💡 [수정됨] 기존 문구로 초기화 복구
        if (loadingText) {
            loadingText.textContent = "로그인 상태를 확인하고 있습니다.";
        }

        return;
    }

    try {

        const response = await fetch(
            "/api/logout",
            {
                method: "POST"
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "로그아웃에 실패했습니다."
            );

        }

        loginSection.classList.remove("hidden");

        userSection.classList.add("hidden");

        /*
         * 상태 초기화
         */
        monitoringMode = null; 
        currentChannelId = null;

        previousFollowers.clear();

        hasInitialSnapshot = false;

        activityItems = [];

        profileCache.clear();

        displayedFollowerCount = 0;

        if (counterAnimationFrame) {

            cancelAnimationFrame(
                counterAnimationFrame
            );

            counterAnimationFrame = null;

        }

        followerCount.textContent = "0";

        channelName.textContent = "-";

        channelId.textContent = "-";

        profileImage.removeAttribute("src");

        renderActivities();

        monitorStatusText.textContent =
            "로그아웃되었습니다.";

        // 💡 [수정됨] 기존 문구로 초기화 복구
        if (loadingText) {
            loadingText.textContent = "로그인 상태를 확인하고 있습니다.";
        }

    } catch (error) {

        console.error(error);

        monitorStatusText.textContent =
            error.message ||
            "로그아웃 중 오류가 발생했습니다.";

    } finally {

        logoutButton.disabled = false;

    }

});


/* ========================================= */
/* 사용자 정보 */
/* ========================================= */

async function loadUser() {
    try {
        const response = await fetch("/api/me", { method: "GET", cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                loadingSection.classList.add("hidden"); 
                loginSection.classList.remove("hidden");
                userSection.classList.add("hidden");
                return false;
            }
            throw new Error(data.error || "사용자 정보를 가져오지 못했습니다.");
        }

        loadingSection.classList.add("hidden");
        loginSection.classList.add("hidden");
        userSection.classList.remove("hidden");
        
        monitoringMode = "login";
        
        logoutButton.textContent = "로그아웃"; 
        
        if (activitySection) activitySection.classList.remove("hidden"); 

        currentChannelId = data.channelId || null;
        channelName.textContent = data.channelName || "-";
        channelId.textContent = data.channelId || "-";

        setProfileImage(profileImage, data.channelImageUrl);

        displayedFollowerCount = 0;
        updateFollowerCount(data.followerCount || 0);

        return true;
    } catch (error) {
        console.error(error);
        loadingSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
        userSection.classList.add("hidden");
        return false;
    }
}


/* ========================================= */
/* 팔로워 수 애니메이션 */
/* ========================================= */

function animateFollowerCount(targetCount) {

    targetCount =
        Number(targetCount) || 0;

    if (
        displayedFollowerCount === targetCount
    ) {

        followerCount.textContent =
            targetCount.toLocaleString("ko-KR");

        return;

    }


    if (counterAnimationFrame) {

        cancelAnimationFrame(
            counterAnimationFrame
        );

        counterAnimationFrame = null;

    }


    const startCount =
        displayedFollowerCount;


    const difference =
        Math.abs(
            targetCount - startCount
        );


    const duration =
        Math.min(
            900,
            Math.max(
                300,
                difference * 100
            )
        );


    const startTime =
        performance.now();


    function update(currentTime) {

        const elapsed =
            currentTime - startTime;


        const progress =
            Math.min(
                elapsed / duration,
                1
            );


        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        const currentValue =
            Math.round(
                startCount +
                (
                    targetCount -
                    startCount
                ) *
                eased
            );


        displayedFollowerCount =
            currentValue;


        followerCount.textContent =
            currentValue.toLocaleString(
                "ko-KR"
            );


        if (progress < 1) {

            counterAnimationFrame =
                requestAnimationFrame(
                    update
                );

        } else {

            displayedFollowerCount =
                targetCount;

            followerCount.textContent =
                targetCount.toLocaleString(
                    "ko-KR"
                );

            counterAnimationFrame =
                null;

        }

    }


    counterAnimationFrame =
        requestAnimationFrame(
            update
        );

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
/* API에서 팔로워 전체 목록 & 카운트 가져오기 */
/* ========================================= */
async function fetchFollowers() {
    const response = await fetch("/api/followers", { method: "GET", cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || `팔로워 정보를 가져오지 못했습니다. (HTTP ${response.status})`);
    }

    return {
        followers: Array.isArray(data.followers) ? data.followers : [],
        totalCount: data.totalCount || 0
    };
}


/* ========================================= */
/* 팔로워 목록을 Map으로 변환 */
/* ========================================= */
function makeFollowerMap(followers) {
    const map = new Map();

    for (const follower of followers) {
        if (!follower) continue;

        const id = follower.user?.userIdHash || follower.channelId;
        const name = follower.user?.nickname || follower.channelName || "알 수 없는 사용자";

        if (!id) continue;

        map.set(id, {
            channelId: id,
            channelName: name,
            createdDate: follower.following?.followDate || follower.createdDate || null
        });
    }

    return map;
}


/* ========================================= */
/* 팔로워 변화 확인 */
/* ========================================= */

function compareFollowers(currentFollowers) {

    if (!hasInitialSnapshot) {

        previousFollowers =
            currentFollowers;

        hasInitialSnapshot = true;

        return;

    }


    for (
        const [id, follower]
        of currentFollowers
    ) {

        if (!previousFollowers.has(id)) {

            handleFollow(follower);

        }

    }


    for (
        const [id, follower]
        of previousFollowers
    ) {

        if (!currentFollowers.has(id)) {

            handleUnfollow(follower);

        }

    }


    previousFollowers =
        currentFollowers;

}


/* ========================================= */
/* 팔로우 처리 */
/* ========================================= */

function handleFollow(follower) {

    console.log(
        "새 팔로워:",
        follower
    );


    const activity = {
        type: "follow",

        channelId:
            follower.channelId,

        channelName:
            follower.channelName ||
            "알 수 없는 사용자",

        channelImageUrl:
            null,

        createdDate:
            follower.createdDate,

        time:
            new Date()
    };


    addActivity(activity);


    loadActivityProfile(activity);

}


/* ========================================= */
/* 언팔로우 처리 */
/* ========================================= */

function handleUnfollow(follower) {

    console.log(
        "팔로워 취소:",
        follower
    );


    const activity = {
        type: "unfollow",

        channelId:
            follower.channelId,

        channelName:
            follower.channelName ||
            "알 수 없는 사용자",

        channelImageUrl:
            null,

        createdDate:
            follower.createdDate,

        time:
            new Date()
    };


    addActivity(activity);


    loadActivityProfile(activity);

}


/* ========================================= */
/* 활동 프로필 정보 비동기 로딩 */
/* ========================================= */

async function loadActivityProfile(activity) {

    if (!activity.channelId) {
        return;
    }


    try {

        const profile =
            await getProfileInfo(
                activity.channelId
            );


        if (profile.channelName) {

            activity.channelName =
                profile.channelName;

        }


        if (profile.channelImageUrl) {

            activity.channelImageUrl =
                profile.channelImageUrl;

        }


        renderActivities();

    } catch (error) {

        console.error(
            "활동 프로필 갱신 오류:",
            error
        );

    }

}


/* ========================================= */
/* 유저 프로필 정보 */
/* ========================================= */

async function getProfileInfo(channelId) {

    if (!channelId) {

        return {
            channelName: null,
            channelImageUrl: null
        };

    }


    if (profileCache.has(channelId)) {

        return profileCache.get(channelId);

    }


    try {

        const response = await fetch(
            `/api/channel?channelId=${encodeURIComponent(channelId)}`,
            {
                method: "GET",
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                `프로필 정보를 가져오지 못했습니다. (HTTP ${response.status})`
            );

        }


        const data =
            await response.json();


        const profile = {

            channelName:
                data.channelName ||
                null,

            channelImageUrl:
                data.channelImageUrl ||
                null

        };


        profileCache.set(
            channelId,
            profile
        );


        return profile;

    } catch (error) {

        console.error(
            "프로필 정보 오류:",
            error
        );


        const fallback = {

            channelName: null,

            channelImageUrl: null

        };


        profileCache.set(
            channelId,
            fallback
        );


        return fallback;

    }

}


/* ========================================= */
/* 프로필 이미지 설정 */
/* ========================================= */
function setProfileImage(imageElement, imageUrl) {
    if (!imageElement) return;

    const defaultImage = "https://ssl.pstatic.net/cmstatic/nng/img/img_anonymous_square_gray_opacity2x.png";
    const finalImageUrl = imageUrl || defaultImage;

    if (imageElement.src === finalImageUrl) {
        return;
    }

    imageElement.setAttribute("referrerpolicy", "no-referrer");

    imageElement.onerror = () => {
        imageElement.onerror = null;
        imageElement.src = defaultImage;
    };

    imageElement.src = finalImageUrl;
}


/* ========================================= */
/* 활동 추가 */
/* ========================================= */

function addActivity(activity) {

    activityItems.unshift(
        activity
    );


    if (activityItems.length > 100) {

        activityItems =
            activityItems.slice(0, 100);

    }


    renderActivities();

}


/* ========================================= */
/* 활동 목록 렌더링 */
/* ========================================= */

function renderActivities() {

    activityList.innerHTML = "";


    if (activityItems.length === 0) {

        activityList.appendChild(
            emptyActivity
        );

        activityCount.textContent = "0";

        return;

    }


    activityCount.textContent =
        activityItems.length.toLocaleString(
            "ko-KR"
        );


    for (
        const activity
        of activityItems
    ) {

        const item =
            createActivityElement(
                activity
            );

        activityList.appendChild(
            item
        );

    }

}


/* ========================================= */
/* 활동 항목 생성 */
/* ========================================= */
function createActivityElement(activity) {
    const item = document.createElement("div");
    item.className = "activity-item";

    const image = document.createElement("img");
    image.className = "activity-image";
    image.alt = activity.channelName || "프로필";
    setProfileImage(image, activity.channelImageUrl);

    const content = document.createElement("div");
    content.className = "activity-content";

    const main = document.createElement("div");
    main.className = "activity-main";

    const name = document.createElement("span");
    name.className = "activity-name";
    name.textContent = activity.channelName || "알 수 없는 사용자";

    const type = document.createElement("span");
    type.className = "activity-type " + (activity.type === "follow" ? "follow" : "unfollow");
    type.textContent = activity.type === "follow" ? "팔로우" : "언팔로우";

    main.appendChild(name);
    main.appendChild(type);

    const time = document.createElement("div");
    time.className = "activity-time";
    time.textContent = formatActivityTime(activity.time);

    content.appendChild(main);
    content.appendChild(time);
    item.appendChild(image);
    item.appendChild(content);

    activity.domNode = item;

    return item;
}

/* ========================================= */
/* 활동 추가 (전체 렌더링 방지) */
/* ========================================= */
function addActivity(activity) {
    activityItems.unshift(activity);

    if (activityItems.length > 100) {
        activityItems.pop(); 
    }

    const item = createActivityElement(activity);

    if (activityList.contains(emptyActivity)) {
        activityList.innerHTML = ""; 
    }

    activityList.prepend(item);

    if (activityList.children.length > 100) {
        activityList.lastElementChild.remove();
    }

    activityCount.textContent = activityItems.length.toLocaleString("ko-KR");
}

/* ========================================= */
/* 활동 프로필 정보 비동기 로딩 (부분 렌더링 적용) */
/* ========================================= */
async function loadActivityProfile(activity) {
    if (!activity.channelId) return;

    try {
        const profile = await getProfileInfo(activity.channelId);

        if (profile.channelName) {
            activity.channelName = profile.channelName;
            if (activity.domNode) {
                activity.domNode.querySelector('.activity-name').textContent = profile.channelName;
            }
        }

        if (profile.channelImageUrl) {
            activity.channelImageUrl = profile.channelImageUrl;
            if (activity.domNode) {
                setProfileImage(activity.domNode.querySelector('.activity-image'), profile.channelImageUrl);
            }
        }
    } catch (error) {
        console.error("활동 프로필 갱신 오류:", error);
    }
}


/* ========================================= */
/* 모니터링 시작 */
/* ========================================= */
async function startMonitoring() {
    if (monitoring) return;
    monitoring = true;
    pollingInProgress = false;
    hasInitialSnapshot = false;

    statusDot.classList.remove("error");
    statusDot.classList.add("loading");
    monitorStatusText.textContent = "팔로워 목록을 불러오는 중...";

    try {
        if (monitoringMode === "public") {
            statusDot.classList.remove("loading");
            statusDot.classList.remove("error");
            monitorStatusText.textContent = "실시간 팔로워 감시 중 (조회 모드)";

            if (pollingTimer) clearInterval(pollingTimer);
            pollingTimer = setInterval(pollFollowers, POLLING_INTERVAL);
        } else {
            const { followers, totalCount } = await fetchFollowers();

            updateFollowerCount(totalCount);

            previousFollowers = makeFollowerMap(followers);
            hasInitialSnapshot = true;

            statusDot.classList.remove("loading");
            statusDot.classList.remove("error");
            monitorStatusText.textContent = "실시간 팔로워 감시 중";

            if (pollingTimer) clearInterval(pollingTimer);
            pollingTimer = setInterval(pollFollowers, POLLING_INTERVAL);
        }

    } catch (error) {
        console.error("Monitoring start error:", error);
        statusDot.classList.remove("loading");
        statusDot.classList.add("error");
        monitorStatusText.textContent = error.message || "팔로워 정보를 가져오지 못했습니다.";
        monitoring = false;
    }
}


/* ========================================= */
/* 5초 polling */
/* ========================================= */
async function pollFollowers() {
    if (pollingInProgress) return;
    pollingInProgress = true;

    try {
        if (monitoringMode === "public") {
            const response = await fetch(`/api/public-channel?channelId=${encodeURIComponent(currentChannelId)}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                updateFollowerCount(data.followerCount || 0);
            }
        } else {
            const { followers, totalCount } = await fetchFollowers();
            updateFollowerCount(totalCount);

            const currentFollowers = makeFollowerMap(followers);
            compareFollowers(currentFollowers);

            updateActivityTimes();
        }

        statusDot.classList.remove("error");
        monitorStatusText.textContent = monitoringMode === "public" ? "실시간 팔로워 감시 중 (조회 모드)" : "실시간 팔로워 감시 중";

        const now = new Date();
        const timeText = formatTime(now);
        lastUpdated.textContent = `${timeText} 업데이트`;

    } catch (error) {
        console.error("Polling error:", error);
        statusDot.classList.add("error");
        monitorStatusText.textContent = "팔로워 정보를 다시 확인하는 중...";
    } finally {
        pollingInProgress = false;
    }
}


/* ========================================= */
/* 모니터링 종료 */
/* ========================================= */

function stopMonitoring() {

    monitoring = false;

    pollingInProgress = false;


    if (pollingTimer) {

        clearInterval(
            pollingTimer
        );

        pollingTimer = null;

    }


    previousFollowers.clear();

    hasInitialSnapshot = false;

}


/* ========================================= */
/* 시간 */
/* ========================================= */

function formatTime(date) {

    if (!(date instanceof Date)) {

        date = new Date(date);

    }


    return date.toLocaleTimeString(
        "ko-KR",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

}


/* ========================================= */
/* 활동 시간 */
/* ========================================= */

function formatActivityTime(date) {

    if (!(date instanceof Date)) {

        date = new Date(date);

    }


    const now =
        new Date();


    const diff =
        now.getTime() -
        date.getTime();


    /*
     * 1분 미만
     */

    if (diff < 60 * 1000) {

        return "방금 전";

    }


    /*
     * 1시간 미만
     */

    if (diff < 60 * 60 * 1000) {

        return `${Math.floor(
            diff / (60 * 1000)
        )}분 전`;

    }


    return date.toLocaleTimeString(
        "ko-KR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* ========================================= */
/* 시작 */
/* ========================================= */

async function initialize() {

    /*
     * 1. 최초 접속 처리 (자동 로그인 방지)
     */
    if (!sessionStorage.getItem("chzzk_init_done")) {

        sessionStorage.setItem("chzzk_init_done", "true");

        /*
         * 💡 핵심 수정 1: UI 즉시 전환
         * await 없이 UI부터 즉시 변경하여 로딩 화면이 깜빡이는 것을 원천 차단합니다.
         */
        loadingSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
        userSection.classList.add("hidden");

        /*
         * 💡 핵심 수정 2: 무의미한 document.cookie 삭제 코드를 빼고
         * 기존 서버 API를 활용하되, await를 빼서 백그라운드에서 조용히 처리하게 합니다.
         */
        fetch("/api/logout", { method: "POST" }).catch(() => {});

        return;

    }


    /*
     * 2. OAuth 복귀 또는 새로고침 시
     * index.html에서 로딩 화면을 기본 hidden 처리했으므로
     * /api/me를 찌르기 전에 명시적으로 로딩 화면을 켜줍니다.
     */
    loadingSection.classList.remove("hidden");
    loginSection.classList.add("hidden");
    userSection.classList.add("hidden");


    const loggedIn =
        await loadUser();


    if (!loggedIn) {

        return;

    }


    await startMonitoring();

}

/* ========================================= */
/* 활동 시간 텍스트 실시간 갱신 */
/* ========================================= */
function updateActivityTimes() {
    for (const activity of activityItems) {
        if (activity.domNode) {
            const timeElement = activity.domNode.querySelector('.activity-time');
            if (timeElement) {
                timeElement.textContent = formatActivityTime(activity.time);
            }
        }
    }
}

initialize();

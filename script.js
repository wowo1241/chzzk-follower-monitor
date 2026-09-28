const loadingSection = document.getElementById("loading-section");
const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");

const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");

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

/*
 * 이전 팔로워 목록
 */
let previousFollowers = new Map();

/*
 * 최초 목록을 이미 저장했는지 여부
 *
 * 기존 코드에서는 previousFollowers.size === 0
 * 을 최초 조회 여부로 사용했기 때문에
 * 팔로워가 0명인 경우 문제가 생길 수 있었다.
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
/* 로그아웃 */
/* ========================================= */

logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;

    stopMonitoring();

    monitorStatusText.textContent =
        "로그아웃하는 중...";

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
                // 💡 수정: 로그인 안 됨 -> 로딩 끄고 로그인 창 켜기
                loadingSection.classList.add("hidden"); 
                loginSection.classList.remove("hidden");
                userSection.classList.add("hidden");
                return false;
            }
            throw new Error(data.error || "사용자 정보를 가져오지 못했습니다.");
        }

        // 💡 수정: 로그인 됨 -> 로딩 끄고 대시보드 켜기
        loadingSection.classList.add("hidden");
        loginSection.classList.add("hidden");
        userSection.classList.remove("hidden");

        currentChannelId = data.channelId || null;
        channelName.textContent = data.channelName || "-";
        channelId.textContent = data.channelId || "-";

        setProfileImage(profileImage, data.channelImageUrl);

        // 💡 수정: 0에서부터 실제 팔로워 수까지 촤라라락 올라가도록 실행
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

    /*
     * 이미 같은 숫자라면
     * 애니메이션을 실행하지 않는다.
     */
    if (
        displayedFollowerCount === targetCount
    ) {

        followerCount.textContent =
            targetCount.toLocaleString("ko-KR");

        return;

    }


    /*
     * 기존 애니메이션 취소
     */
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


    /*
     * 변화량에 따라 애니메이션 속도 조절
     */
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


        /*
         * ease-out
         */
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

    // 💡 값을 넣기만 하면 Odometer 라이브러리가 알아서 촤라라락 굴려줌
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

    // 💡 목록과 총 팔로워 수를 객체로 묶어서 반환
    return {
        followers: Array.isArray(data.followers) ? data.followers : [],
        totalCount: data.totalCount || 0
    };
}


/* ========================================= */
/* 팔로워 목록을 Map으로 변환 (공식 API JSON 구조 반영) */
/* ========================================= */
function makeFollowerMap(followers) {
    const map = new Map();

    for (const follower of followers) {
        if (!follower) continue;

        // 💡 중요: 공식 API 응답 구조(user.userIdHash)에 맞게 데이터 추출
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

    /*
     * 최초 조회
     *
     * 기존 코드처럼 size === 0 을 사용하지 않는다.
     *
     * 팔로워가 0명이어도 최초 스냅샷으로
     * 정확하게 기록된다.
     */
    if (!hasInitialSnapshot) {

        previousFollowers =
            currentFollowers;

        hasInitialSnapshot = true;

        return;

    }


    /*
     * 새로 생긴 팔로워
     */

    for (
        const [id, follower]
        of currentFollowers
    ) {

        if (!previousFollowers.has(id)) {

            handleFollow(follower);

        }

    }


    /*
     * 사라진 팔로워
     */

    for (
        const [id, follower]
        of previousFollowers
    ) {

        if (!currentFollowers.has(id)) {

            handleUnfollow(follower);

        }

    }


    /*
     * 현재 상태를 다음 비교 기준으로 저장
     */

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


    /*
     * 중요:
     *
     * 기존에는 getProfileInfo()를
     * await한 다음 활동을 표시했다.
     *
     * 그래서 프로필 API가 늦으면
     * 팔로우 표시 자체가 늦어졌다.
     *
     * 이제는 팔로우를 감지하면
     * 활동을 먼저 즉시 표시한다.
     */

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


    /*
     * 프로필 정보는 뒤에서 비동기로 가져온다.
     */
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


    /*
     * 언팔로우도 즉시 표시
     */

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


    /*
     * 프로필 정보는 별도로 가져온다.
     */
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


        /*
         * 프로필 정보를 받은 후
         * 활동 데이터만 갱신한다.
         */

        if (profile.channelName) {

            activity.channelName =
                profile.channelName;

        }


        if (profile.channelImageUrl) {

            activity.channelImageUrl =
                profile.channelImageUrl;

        }


        /*
         * 활동 목록을 다시 그린다.
         */
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


    /*
     * 이미 가져온 유저라면
     * 다시 요청하지 않는다.
     */

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


        /*
         * 실패한 경우에도 캐시에 저장해서
         * 매 polling마다 같은 유저에게
         * 계속 요청하지 않도록 한다.
         */

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
/* 프로필 이미지 설정 (null 및 깜빡임 방지) */
/* ========================================= */
function setProfileImage(imageElement, imageUrl) {
    if (!imageElement) return;

    const defaultImage = "https://ssl.pstatic.net/cmstatic/nng/img/img_anonymous_square_gray_opacity2x.png";
    const finalImageUrl = imageUrl || defaultImage;

    // 💡 핵심: 이미 같은 프로필 이미지가 박혀있다면 다시 씌우지 않음 (깜빡임 완벽 해결)
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


    /*
     * 최근 100개만 유지
     */

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
/* 활동 항목 생성 (domNode 저장 추가) */
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

    // 💡 핵심: 나중에 이 요소만 부분 업데이트하기 위해 DOM 노드를 저장해둡니다.
    activity.domNode = item;

    return item;
}

/* ========================================= */
/* 활동 추가 (전체 렌더링 방지) */
/* ========================================= */
function addActivity(activity) {
    activityItems.unshift(activity);

    if (activityItems.length > 100) {
        activityItems.pop(); // 오래된 데이터 삭제
    }

    const item = createActivityElement(activity);

    // '아직 확인된 활동이 없습니다' 메시지 제거
    if (activityList.contains(emptyActivity)) {
        activityList.innerHTML = ""; 
    }

    // 💡 핵심: 전체를 다시 그리지 않고, 새 항목만 리스트 맨 위에 살짝 밀어넣음
    activityList.prepend(item);

    // 화면에서도 100개가 넘어가면 제일 밑에 있는 항목 하나만 삭제
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
            // 리스트 전체를 다시 그리지 않고, 저장해둔 DOM에서 이름만 교체
            if (activity.domNode) {
                activity.domNode.querySelector('.activity-name').textContent = profile.channelName;
            }
        }

        if (profile.channelImageUrl) {
            activity.channelImageUrl = profile.channelImageUrl;
            // 리스트 전체를 다시 그리지 않고, 저장해둔 DOM에서 이미지만 교체
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
        // 💡 핵심: me.js 없이 이거 하나로 데이터 2개를 동시에 가져옴
        const { followers, totalCount } = await fetchFollowers();

        // 가져온 카운트로 즉시 숫자 업데이트
        updateFollowerCount(totalCount);

        previousFollowers = makeFollowerMap(followers);
        hasInitialSnapshot = true;

        statusDot.classList.remove("loading");
        statusDot.classList.remove("error");
        monitorStatusText.textContent = "실시간 팔로워 감시 중";

        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(pollFollowers, POLLING_INTERVAL);

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
        const { followers, totalCount } = await fetchFollowers();
        updateFollowerCount(totalCount);

        const currentFollowers = makeFollowerMap(followers);
        compareFollowers(currentFollowers);

        // 💡 추가: 5초마다 기존 항목들의 시간 텍스트를 최신화 ("방금 전" -> "1분 전" 등)
        updateActivityTimes();

        statusDot.classList.remove("error");
        monitorStatusText.textContent = "실시간 팔로워 감시 중";

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

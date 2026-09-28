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

const footerTime =
    document.getElementById("footer-time");


/* ========================================= */
/* 설정 */
/* ========================================= */

const POLLING_INTERVAL = 5000;

let pollingTimer = null;

let monitoring = false;

let currentChannelId = null;

let previousFollowers = new Map();

let activityItems = [];

const profileCache = new Map();


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

        previousFollowers.clear();

        activityItems = [];

        renderActivities();

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

        const response = await fetch(
            "/api/me",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok) {

            if (response.status === 401) {

                loginSection.classList.remove("hidden");

                userSection.classList.add("hidden");

                return false;

            }

            throw new Error(
                data.error ||
                "사용자 정보를 가져오지 못했습니다."
            );

        }


        loginSection.classList.add("hidden");

        userSection.classList.remove("hidden");


        currentChannelId =
            data.channelId || null;


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


        updateFollowerCount(
            data.followerCount
        );


        return true;

    } catch (error) {

        console.error(error);

        loginSection.classList.remove("hidden");

        userSection.classList.add("hidden");

        return false;

    }

}


/* ========================================= */
/* 팔로워 수 갱신 */
/* ========================================= */

function updateFollowerCount(count) {

    const number =
        Number(count || 0);

    followerCount.textContent =
        number.toLocaleString("ko-KR");

}


/* ========================================= */
/* 공식 API에서 현재 팔로워 수 갱신 */
/* ========================================= */

async function refreshFollowerCount() {

    const response = await fetch(
        "/api/me",
        {
            method: "GET",
            cache: "no-store"
        }
    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.error ||
            "팔로워 수를 가져오지 못했습니다."
        );

    }

    updateFollowerCount(
        data.followerCount
    );

    if (data.channelImageUrl) {

        profileImage.src =
            data.channelImageUrl;

    }

    const now = new Date();

    const timeText =
        formatTime(now);

    lastUpdated.textContent =
        `${timeText} 업데이트`;

    footerTime.textContent =
        timeText;

}


/* ========================================= */
/* 비공식 API에서 팔로워 전체 목록 가져오기 */
/* ========================================= */

async function fetchFollowers() {

    const response = await fetch(
        "/api/followers",
        {
            method: "GET",
            cache: "no-store"
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {

        throw new Error(
            data.error ||
            "팔로워 목록을 가져오지 못했습니다."
        );

    }

    return Array.isArray(data.followers)
        ? data.followers
        : [];

}


/* ========================================= */
/* 팔로워 목록을 Map으로 변환 */
/* ========================================= */

function makeFollowerMap(followers) {

    const map = new Map();

    for (const follower of followers) {

        if (!follower) {
            continue;
        }

        if (!follower.channelId) {
            continue;
        }

        map.set(
            follower.channelId,
            {
                channelId:
                    follower.channelId,

                channelName:
                    follower.channelName ||
                    "알 수 없는 사용자",

                createdDate:
                    follower.createdDate ||
                    null
            }
        );

    }

    return map;

}


/* ========================================= */
/* 팔로워 변화 확인 */
/* ========================================= */

function compareFollowers(currentFollowers) {

    /*
     * 첫 조회:
     *
     * 기존 팔로워들은 활동 내역으로
     * 표시하지 않는다.
     */

    if (previousFollowers.size === 0) {

        previousFollowers =
            currentFollowers;

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

async function handleFollow(follower) {

    console.log(
        "새 팔로워:",
        follower
    );


    const profile =
        await getProfileInfo(
            follower.channelId
        );


    addActivity({
        type: "follow",

        channelId:
            follower.channelId,

        channelName:
            profile.channelName ||
            follower.channelName,

        channelImageUrl:
            profile.channelImageUrl ||
            null,

        createdDate:
            follower.createdDate,

        time:
            new Date()
    });

}


/* ========================================= */
/* 언팔로우 처리 */
/* ========================================= */

async function handleUnfollow(follower) {

    console.log(
        "팔로워 취소:",
        follower
    );


    const profile =
        await getProfileInfo(
            follower.channelId
        );


    addActivity({
        type: "unfollow",

        channelId:
            follower.channelId,

        channelName:
            profile.channelName ||
            follower.channelName,

        channelImageUrl:
            profile.channelImageUrl ||
            null,

        createdDate:
            follower.createdDate,

        time:
            new Date()
    });

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
                "프로필 정보를 가져오지 못했습니다."
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
/* 활동 추가 */
/* ========================================= */

function addActivity(activity) {

    activityItems.unshift(
        activity
    );


    /*
     * 너무 오래 쌓이지 않도록
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
        activityItems.length.toLocaleString("ko-KR");


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

    const item =
        document.createElement("div");

    item.className =
        "activity-item";


    const image =
        document.createElement("img");

    image.className =
        "activity-image";

    image.alt =
        activity.channelName ||
        "프로필";


    if (activity.channelImageUrl) {

        image.src =
            activity.channelImageUrl;

    }


    const content =
        document.createElement("div");

    content.className =
        "activity-content";


    const main =
        document.createElement("div");

    main.className =
        "activity-main";


    const name =
        document.createElement("span");

    name.className =
        "activity-name";

    name.textContent =
        activity.channelName ||
        "알 수 없는 사용자";


    const type =
        document.createElement("span");

    type.className =
        "activity-type " +
        (
            activity.type === "follow"
                ? "follow"
                : "unfollow"
        );

    type.textContent =
        activity.type === "follow"
            ? "팔로우"
            : "언팔로우";


    main.appendChild(name);

    main.appendChild(type);


    const time =
        document.createElement("div");

    time.className =
        "activity-time";

    time.textContent =
        formatActivityTime(
            activity.time
        );


    content.appendChild(main);

    content.appendChild(time);


    item.appendChild(image);

    item.appendChild(content);


    return item;

}


/* ========================================= */
/* 모니터링 시작 */
/* ========================================= */

async function startMonitoring() {

    if (monitoring) {
        return;
    }

    monitoring = true;

    statusDot.classList.remove("error");

    statusDot.classList.add("loading");

    monitorStatusText.textContent =
        "팔로워 목록을 불러오는 중...";


    try {

        /*
         * 최초 기준 목록
         */

        const followers =
            await fetchFollowers();


        previousFollowers =
            makeFollowerMap(
                followers
            );


        /*
         * 공식 API 팔로워 수
         */

        await refreshFollowerCount();


        statusDot.classList.remove(
            "loading"
        );

        monitorStatusText.textContent =
            "실시간 팔로워 감시 중";


        /*
         * 5초마다 확인
         */

        pollingTimer =
            setInterval(
                pollFollowers,
                POLLING_INTERVAL
            );


    } catch (error) {

        console.error(error);

        statusDot.classList.remove(
            "loading"
        );

        statusDot.classList.add(
            "error"
        );

        monitorStatusText.textContent =
            "팔로워 정보를 가져오지 못했습니다.";

        monitoring = false;

    }

}


/* ========================================= */
/* 5초 polling */
/* ========================================= */

async function pollFollowers() {

    try {

        /*
         * 공식 API:
         * 현재 팔로워 수
         */

        await refreshFollowerCount();


        /*
         * 비공식 API:
         * 전체 팔로워 목록
         */

        const followers =
            await fetchFollowers();


        const currentFollowers =
            makeFollowerMap(
                followers
            );


        /*
         * 변화 비교
         */

        compareFollowers(
            currentFollowers
        );


        statusDot.classList.remove(
            "error"
        );

        monitorStatusText.textContent =
            "실시간 팔로워 감시 중";


    } catch (error) {

        console.error(
            "Polling error:",
            error
        );


        statusDot.classList.add(
            "error"
        );

        monitorStatusText.textContent =
            "팔로워 정보를 다시 확인하는 중...";

    }

}


/* ========================================= */
/* 모니터링 종료 */
/* ========================================= */

function stopMonitoring() {

    monitoring = false;


    if (pollingTimer) {

        clearInterval(
            pollingTimer
        );

        pollingTimer = null;

    }


    previousFollowers.clear();

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


initialize();

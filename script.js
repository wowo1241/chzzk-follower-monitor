```javascript
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
 * 롤링 카운터 초기화 여부
 */
let rollingCounterInitialized = false;

/*
 * 롤링 카운터 애니메이션
 */
let rollingAnimationFrame = null;

/*
 * polling 중복 실행 방지
 */
let pollingInProgress = false;


/* ========================================= */
/* 롤링 카운터 CSS */
/* ========================================= */

function initRollingCounterStyle() {

    if (
        document.getElementById(
            "rolling-follower-counter-style"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");


    style.id =
        "rolling-follower-counter-style";


    style.textContent = `

        #follower-count.rolling-counter {

            display: flex;

            align-items: center;

            justify-content: center;

            white-space: nowrap;

            overflow: visible;

            line-height: 1;

        }


        #follower-count
        .rolling-digit {

            position: relative;

            display: inline-block;

            width: 0.68em;

            height: 1.15em;

            overflow: hidden;

            vertical-align: middle;

            flex: 0 0 0.68em;

        }


        #follower-count
        .rolling-track {

            position: absolute;

            left: 0;

            top: 0;

            width: 100%;

            display: flex;

            flex-direction: column;

            transform: translateY(0);

            will-change: transform;

        }


        #follower-count
        .rolling-number {

            display: flex;

            align-items: center;

            justify-content: center;

            width: 100%;

            height: 1.15em;

            flex: 0 0 1.15em;

            line-height: 1;

        }


        #follower-count
        .rolling-comma {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            width: 0.25em;

            height: 1.15em;

            flex: 0 0 0.25em;

            line-height: 1;

        }


        #follower-count
        .rolling-track.rolling-moving {

            transition:
                transform
                0.55s
                cubic-bezier(
                    0.22,
                    0.61,
                    0.36,
                    1
                );

        }

    `;


    document.head.appendChild(style);

}


/* ========================================= */
/* 롤링 숫자 슬롯 생성 */
/* ========================================= */

function createRollingDigit(
    digit
) {

    const wrapper =
        document.createElement("span");


    wrapper.className =
        "rolling-digit";


    const track =
        document.createElement("span");


    track.className =
        "rolling-track";


    /*
     * 0~9를 여러 번 반복한다.
     *
     * 가운데 영역을 현재 위치로 사용하기
     * 때문에 위/아래로 충분히 움직일 수 있다.
     */

    const repeatCount = 5;


    for (
        let repeat = 0;
        repeat < repeatCount;
        repeat++
    ) {

        for (
            let number = 0;
            number <= 9;
            number++
        ) {

            const numberElement =
                document.createElement("span");


            numberElement.className =
                "rolling-number";


            numberElement.textContent =
                number;


            track.appendChild(
                numberElement
            );

        }

    }


    wrapper.appendChild(
        track
    );


    /*
     * 가운데 반복 영역의 시작 위치.
     *
     * 5회 반복 중 3번째 영역을 사용한다.
     */

    const initialIndex =
        20 + digit;


    track.style.transform =
        `translateY(-${initialIndex * 1.15}em)`;


    wrapper.dataset.index =
        String(initialIndex);


    wrapper.dataset.digit =
        String(digit);


    return wrapper;

}


/* ========================================= */
/* 롤링 카운터 전체 생성 */
/* ========================================= */

function buildRollingCounter(
    value
) {

    initRollingCounterStyle();


    const formatted =
        Number(value || 0)
            .toLocaleString("ko-KR");


    followerCount.innerHTML = "";


    followerCount.classList.add(
        "rolling-counter"
    );


    for (
        const character
        of formatted
    ) {

        /*
         * 콤마
         */

        if (character === ",") {

            const comma =
                document.createElement("span");


            comma.className =
                "rolling-comma";


            comma.textContent =
                ",";


            followerCount.appendChild(
                comma
            );


            continue;

        }


        /*
         * 숫자
         */

        const digit =
            createRollingDigit(
                Number(character)
            );


        followerCount.appendChild(
            digit
        );

    }


    rollingCounterInitialized =
        true;

}


/* ========================================= */
/* 롤링 카운터 숫자 업데이트 */
/* ========================================= */

function animateRollingFollowerCount(
    targetCount
) {

    const target =
        Math.max(
            0,
            Number(targetCount) || 0
        );


    /*
     * 최초 표시
     */

    if (
        !rollingCounterInitialized
    ) {

        displayedFollowerCount =
            target;


        buildRollingCounter(
            target
        );


        return;

    }


    /*
     * 같은 숫자면 아무것도 하지 않는다.
     */

    if (
        displayedFollowerCount === target
    ) {

        return;

    }


    /*
     * 기존 애니메이션이 있다면 취소
     */

    if (rollingAnimationFrame) {

        cancelAnimationFrame(
            rollingAnimationFrame
        );

        rollingAnimationFrame = null;

    }


    /*
     * 현재 표시값과 목표값
     */

    const startValue =
        displayedFollowerCount;


    /*
     * 자리수가 달라지는 경우
     *
     * 예:
     *
     * 999 → 1,000
     * 1,000 → 999
     *
     * 전체 슬롯 구조를 새로 만든다.
     */

    const oldFormatted =
        startValue.toLocaleString(
            "ko-KR"
        );


    const newFormatted =
        target.toLocaleString(
            "ko-KR"
        );


    if (
        oldFormatted.length !==
        newFormatted.length
    ) {

        /*
         * 숫자 구조가 바뀌기 직전에
         * 현재 숫자를 기준으로 한 번 렌더링.
         */

        buildRollingCounter(
            startValue
        );


        /*
         * 다음 프레임에 목표 숫자로
         * 슬롯을 변경한다.
         */

        rollingAnimationFrame =
            requestAnimationFrame(() => {

                buildRollingCounter(
                    target
                );


                displayedFollowerCount =
                    target;


                rollingAnimationFrame =
                    null;

            });


        return;

    }


    /*
     * 현재 숫자의 각 자리
     */

    const oldCharacters =
        oldFormatted.split("");


    /*
     * 목표 숫자의 각 자리
     */

    const newCharacters =
        newFormatted.split("");


    /*
     * 숫자 슬롯
     */

    const digitSlots =
        Array.from(
            followerCount.querySelectorAll(
                ".rolling-digit"
            )
        );


    /*
     * 전체 증가/감소 방향
     */

    const direction =
        target > startValue
            ? 1
            : -1;


    let digitSlotIndex = 0;


    for (
        let i = 0;
        i < newCharacters.length;
        i++
    ) {

        const newCharacter =
            newCharacters[i];


        /*
         * 콤마는 숫자 슬롯이 아니므로
         * 건너뛴다.
         */

        if (
            newCharacter === ","
        ) {

            continue;

        }


        const oldCharacter =
            oldCharacters[i];


        const slot =
            digitSlots[
                digitSlotIndex
            ];


        digitSlotIndex++;


        if (!slot) {
            continue;
        }


        const track =
            slot.querySelector(
                ".rolling-track"
            );


        if (!track) {
            continue;
        }


        const oldDigit =
            Number(oldCharacter);


        const newDigit =
            Number(newCharacter);


        /*
         * 같은 숫자는 움직이지 않는다.
         */

        if (
            oldDigit === newDigit
        ) {

            continue;

        }


        let currentIndex =
            Number(
                slot.dataset.index
            );


        /*
         * 증가:
         *
         * 2 → 3
         * 8 → 9
         * 9 → 0
         *
         * 모두 위쪽으로 이동.
         */

        if (
            direction > 0
        ) {

            let difference =
                newDigit -
                oldDigit;


            if (
                difference <= 0
            ) {

                difference += 10;

            }


            currentIndex +=
                difference;

        }


        /*
         * 감소:
         *
         * 8 → 7
         * 2 → 1
         *
         * 아래쪽으로 이동.
         */

        else {

            let difference =
                oldDigit -
                newDigit;


            if (
                difference <= 0
            ) {

                difference += 10;

            }


            currentIndex -=
                difference;

        }


        /*
         * 안전 범위.
         *
         * 슬롯 중앙 부근에서 계속
         * 굴러가도록 유지한다.
         */

        if (
            currentIndex > 35
        ) {

            currentIndex -= 20;

        }


        if (
            currentIndex < 5
        ) {

            currentIndex += 20;

        }


        slot.dataset.index =
            String(currentIndex);


        slot.dataset.digit =
            String(newDigit);


        track.classList.add(
            "rolling-moving"
        );


        track.style.transform =
            `translateY(-${currentIndex * 1.15}em)`;


        /*
         * 애니메이션이 끝난 뒤
         * 클래스만 제거한다.
         */

        window.setTimeout(
            () => {

                track.classList.remove(
                    "rolling-moving"
                );

            },
            600
        );

    }


    displayedFollowerCount =
        target;

}


/* ========================================= */
/* 팔로워 수 갱신 */
/* ========================================= */

function updateFollowerCount(count) {

    const number =
        Number(count || 0);


    animateRollingFollowerCount(
        number
    );

}


/* ========================================= */
/* 로그인 */
/* ========================================= */

loginButton.addEventListener("click", () => {

    window.location.href =
        "/api/login";

});


/* ========================================= */
/* 로그아웃 */
/* ========================================= */

logoutButton.addEventListener(
    "click",
    async () => {

        logoutButton.disabled = true;


        stopMonitoring();


        monitorStatusText.textContent =
            "로그아웃하는 중...";


        try {

            const response =
                await fetch(
                    "/api/logout",
                    {
                        method: "POST"
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "로그아웃에 실패했습니다."
                );

            }


            loginSection.classList.remove(
                "hidden"
            );


            userSection.classList.add(
                "hidden"
            );


            /*
             * 상태 초기화
             */

            currentChannelId =
                null;


            previousFollowers.clear();


            hasInitialSnapshot =
                false;


            activityItems = [];


            profileCache.clear();


            displayedFollowerCount =
                0;


            rollingCounterInitialized =
                false;


            if (
                rollingAnimationFrame
            ) {

                cancelAnimationFrame(
                    rollingAnimationFrame
                );


                rollingAnimationFrame =
                    null;

            }


            followerCount.innerHTML =
                "0";


            followerCount.classList.remove(
                "rolling-counter"
            );


            channelName.textContent =
                "-";


            channelId.textContent =
                "-";


            profileImage.removeAttribute(
                "src"
            );


            renderActivities();


            monitorStatusText.textContent =
                "로그아웃되었습니다.";


        } catch (error) {

            console.error(error);


            monitorStatusText.textContent =
                error.message ||
                "로그아웃 중 오류가 발생했습니다.";


        } finally {

            logoutButton.disabled =
                false;

        }

    }
);


/* ========================================= */
/* 사용자 정보 */
/* ========================================= */

async function loadUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            if (
                response.status === 401
            ) {

                loginSection.classList.remove(
                    "hidden"
                );


                userSection.classList.add(
                    "hidden"
                );


                return false;

            }


            throw new Error(
                data.error ||
                "사용자 정보를 가져오지 못했습니다."
            );

        }


        loginSection.classList.add(
            "hidden"
        );


        userSection.classList.remove(
            "hidden"
        );


        currentChannelId =
            data.channelId || null;


        channelName.textContent =
            data.channelName || "-";


        channelId.textContent =
            data.channelId || "-";


        if (
            data.channelImageUrl
        ) {

            setProfileImage(
                profileImage,
                data.channelImageUrl
            );

        } else {

            profileImage.removeAttribute(
                "src"
            );

        }


        /*
         * 최초 로그인 시
         * 롤링 카운터를 생성한다.
         */

        displayedFollowerCount =
            Number(
                data.followerCount || 0
            );


        buildRollingCounter(
            displayedFollowerCount
        );


        return true;


    } catch (error) {

        console.error(error);


        loginSection.classList.remove(
            "hidden"
        );


        userSection.classList.add(
            "hidden"
        );


        return false;

    }

}


/* ========================================= */
/* 공식 API에서 현재 팔로워 수 갱신 */
/* ========================================= */

async function refreshFollowerCount() {

    const response =
        await fetch(
            "/api/me",
            {
                method: "GET",
                cache: "no-store"
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "팔로워 수를 가져오지 못했습니다."
        );

    }


    updateFollowerCount(
        data.followerCount
    );


    /*
     * 채널 정보가 변경될 경우
     * 프로필 이미지도 갱신
     */

    if (
        data.channelImageUrl
    ) {

        setProfileImage(
            profileImage,
            data.channelImageUrl
        );

    }


    const now =
        new Date();


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

    const response =
        await fetch(
            "/api/followers",
            {
                method: "GET",
                cache: "no-store"
            }
        );


    const data =
        await response.json();


    if (
        !response.ok ||
        !data.success
    ) {

        throw new Error(
            data.error ||
            `팔로워 목록을 가져오지 못했습니다. (HTTP ${response.status})`
        );

    }


    return Array.isArray(
        data.followers
    )
        ? data.followers
        : [];

}


/* ========================================= */
/* 팔로워 목록을 Map으로 변환 */
/* ========================================= */

function makeFollowerMap(followers) {

    const map =
        new Map();


    for (
        const follower
        of followers
    ) {

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

function compareFollowers(
    currentFollowers
) {

    /*
     * 최초 조회
     */

    if (
        !hasInitialSnapshot
    ) {

        previousFollowers =
            currentFollowers;


        hasInitialSnapshot =
            true;


        return;

    }


    /*
     * 새로 생긴 팔로워
     */

    for (
        const [id, follower]
        of currentFollowers
    ) {

        if (
            !previousFollowers.has(id)
        ) {

            handleFollow(
                follower
            );

        }

    }


    /*
     * 사라진 팔로워
     */

    for (
        const [id, follower]
        of previousFollowers
    ) {

        if (
            !currentFollowers.has(id)
        ) {

            handleUnfollow(
                follower
            );

        }

    }


    /*
     * 현재 상태 저장
     */

    previousFollowers =
        currentFollowers;

}


/* ========================================= */
/* 팔로우 처리 */
/* ========================================= */

function handleFollow(
    follower
) {

    console.log(
        "새 팔로워:",
        follower
    );


    /*
     * 활동을 즉시 표시한다.
     */

    const activity = {

        type:
            "follow",

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


    addActivity(
        activity
    );


    /*
     * 프로필 정보는
     * 뒤에서 비동기로 가져온다.
     */

    loadActivityProfile(
        activity
    );

}


/* ========================================= */
/* 언팔로우 처리 */
/* ========================================= */

function handleUnfollow(
    follower
) {

    console.log(
        "팔로워 취소:",
        follower
    );


    /*
     * 언팔로우도 즉시 표시
     */

    const activity = {

        type:
            "unfollow",

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


    addActivity(
        activity
    );


    /*
     * 프로필 정보는
     * 별도로 가져온다.
     */

    loadActivityProfile(
        activity
    );

}


/* ========================================= */
/* 활동 프로필 정보 비동기 로딩 */
/* ========================================= */

async function loadActivityProfile(
    activity
) {

    if (!activity.channelId) {
        return;
    }


    try {

        const profile =
            await getProfileInfo(
                activity.channelId
            );


        if (
            profile.channelName
        ) {

            activity.channelName =
                profile.channelName;

        }


        if (
            profile.channelImageUrl
        ) {

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

async function getProfileInfo(
    channelId
) {

    if (!channelId) {

        return {

            channelName:
                null,

            channelImageUrl:
                null

        };

    }


    /*
     * 캐시 사용
     */

    if (
        profileCache.has(
            channelId
        )
    ) {

        return profileCache.get(
            channelId
        );

    }


    try {

        const response =
            await fetch(
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

            channelName:
                null,

            channelImageUrl:
                null

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

function setProfileImage(
    imageElement,
    imageUrl
) {

    if (
        !imageElement ||
        !imageUrl
    ) {
        return;
    }


    imageElement.onerror =
        null;


    imageElement.onerror =
        () => {

            imageElement.onerror =
                null;

            imageElement.removeAttribute(
                "src"
            );

        };


    imageElement.src =
        imageUrl;

}


/* ========================================= */
/* 활동 추가 */
/* ========================================= */

function addActivity(
    activity
) {

    activityItems.unshift(
        activity
    );


    /*
     * 최근 100개만 유지
     */

    if (
        activityItems.length > 100
    ) {

        activityItems =
            activityItems.slice(
                0,
                100
            );

    }


    renderActivities();

}


/* ========================================= */
/* 활동 목록 렌더링 */
/* ========================================= */

function renderActivities() {

    activityList.innerHTML =
        "";


    if (
        activityItems.length === 0
    ) {

        activityList.appendChild(
            emptyActivity
        );


        activityCount.textContent =
            "0";


        return;

    }


    activityCount.textContent =
        activityItems.length
            .toLocaleString(
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

function createActivityElement(
    activity
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "activity-item";


    /*
     * 프로필 이미지
     */

    const image =
        document.createElement(
            "img"
        );


    image.className =
        "activity-image";


    image.alt =
        activity.channelName ||
        "프로필";


    if (
        activity.channelImageUrl
    ) {

        setProfileImage(
            image,
            activity.channelImageUrl
        );

    }


    /*
     * 내용
     */

    const content =
        document.createElement(
            "div"
        );


    content.className =
        "activity-content";


    const main =
        document.createElement(
            "div"
        );


    main.className =
        "activity-main";


    const name =
        document.createElement(
            "span"
        );


    name.className =
        "activity-name";


    name.textContent =
        activity.channelName ||
        "알 수 없는 사용자";


    const type =
        document.createElement(
            "span"
        );


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


    main.appendChild(
        name
    );


    main.appendChild(
        type
    );


    const time =
        document.createElement(
            "div"
        );


    time.className =
        "activity-time";


    time.textContent =
        formatActivityTime(
            activity.time
        );


    content.appendChild(
        main
    );


    content.appendChild(
        time
    );


    item.appendChild(
        image
    );


    item.appendChild(
        content
    );


    return item;

}


/* ========================================= */
/* 모니터링 시작 */
/* ========================================= */

async function startMonitoring() {

    if (monitoring) {
        return;
    }


    monitoring =
        true;


    pollingInProgress =
        false;


    hasInitialSnapshot =
        false;


    statusDot.classList.remove(
        "error"
    );


    statusDot.classList.add(
        "loading"
    );


    monitorStatusText.textContent =
        "팔로워 목록을 불러오는 중...";


    try {

        /*
         * 팔로워 목록과
         * 공식 팔로워 수를 동시에 요청
         */

        const [
            followers
        ] = await Promise.all([
            fetchFollowers(),
            refreshFollowerCount()
        ]);


        /*
         * 최초 기준 목록
         */

        previousFollowers =
            makeFollowerMap(
                followers
            );


        hasInitialSnapshot =
            true;


        statusDot.classList.remove(
            "loading"
        );


        statusDot.classList.remove(
            "error"
        );


        monitorStatusText.textContent =
            "실시간 팔로워 감시 중";


        /*
         * 기존 polling 제거
         */

        if (pollingTimer) {

            clearInterval(
                pollingTimer
            );

        }


        /*
         * 5초마다 확인
         */

        pollingTimer =
            setInterval(
                pollFollowers,
                POLLING_INTERVAL
            );


    } catch (error) {

        console.error(
            "Monitoring start error:",
            error
        );


        statusDot.classList.remove(
            "loading"
        );


        statusDot.classList.add(
            "error"
        );


        monitorStatusText.textContent =
            error.message ||
            "팔로워 정보를 가져오지 못했습니다.";


        monitoring =
            false;

    }

}


/* ========================================= */
/* 5초 polling */
/* ========================================= */

async function pollFollowers() {

    /*
     * 이전 polling이 아직 끝나지 않았다면
     * 이번 요청은 건너뛴다.
     */

    if (
        pollingInProgress
    ) {

        console.log(
            "이전 polling이 아직 진행 중입니다."
        );


        return;

    }


    pollingInProgress =
        true;


    try {

        /*
         * 두 API를 동시에 호출
         */

        const [
            _,
            followers
        ] = await Promise.all([
            refreshFollowerCount(),
            fetchFollowers()
        ]);


        /*
         * 현재 팔로워 목록
         */

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


    } finally {

        pollingInProgress =
            false;

    }

}


/* ========================================= */
/* 모니터링 종료 */
/* ========================================= */

function stopMonitoring() {

    monitoring =
        false;


    pollingInProgress =
        false;


    if (pollingTimer) {

        clearInterval(
            pollingTimer
        );


        pollingTimer =
            null;

    }


    previousFollowers.clear();


    hasInitialSnapshot =
        false;

}


/* ========================================= */
/* 시간 */
/* ========================================= */

function formatTime(
    date
) {

    if (
        !(date instanceof Date)
    ) {

        date =
            new Date(date);

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

function formatActivityTime(
    date
) {

    if (
        !(date instanceof Date)
    ) {

        date =
            new Date(date);

    }


    const now =
        new Date();


    const diff =
        now.getTime() -
        date.getTime();


    /*
     * 1분 미만
     */

    if (
        diff < 60 * 1000
    ) {

        return "방금 전";

    }


    /*
     * 1시간 미만
     */

    if (
        diff < 60 * 60 * 1000
    ) {

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
```

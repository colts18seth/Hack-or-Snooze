$(async function() {
	// cache some selectors we'll be using quite a bit
	const $createAccountForm = $("#create-account-form");
	const $favoritedArticles = $("#favorited-articles");
	const $navUserProfile = $("#nav-user-profile");
	const $navWelcome = $("#nav-welcome");
	const $allStoriesList = $("#all-articles-list");
	const $submitForm = $("#submit-form");
	const $navLogOut = $("#nav-logout");
	const $userProfile = $("#user-profile");
	const $ownStories = $("#my-articles");
	const $navSubmit = $("#nav-submit");
	const $loginForm = $("#login-form");
	const $navLogin = $("#nav-login");
	const $body = $("body");

	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	/**
	 * Event listener for logging in.
	 *  If successfully we will setup the user instance
	 */
	$loginForm.on("submit", async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $("#login-username").val();
		const password = $("#login-password").val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
	 * Event listener for signing up.
	 *  If successfully we will setup a new user instance
	 */
	$createAccountForm.on("submit", async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $("#create-account-name").val();
		let username = $("#create-account-username").val();
		let password = $("#create-account-password").val();

		// call the create method, which calls the API and then builds a new user instance
		const newUser = await User.create(username, password, name);
		currentUser = newUser;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	$submitForm.on("submit", async function(e) {
		e.preventDefault();

		let author = $("#author").val();
		let title = $("#title").val();
		let url = $("#url").val();
		let hostName = getHostName(url);
		let username = currentUser.username;

		const storyObject = await storyList.addStory(currentUser, {
			title,
			author,
			url,
			username
		});

		const storyMarkup = $(`
        <li id="${storyObject.storyId}">
            <span class="star">
                <i class="far fa-star"></i>
            </span>
            <a class="article-link" href="${url}" target="a_blank">
                <strong>${title}</strong>
            </a>
            <small class="article-hostname">(${hostName})</small>
            <small class="article-author">by ${author}</small>
            <small class="article-username">posted by ${username}</small>
        </li>
    `);
		$allStoriesList.prepend(storyMarkup);
		$submitForm.slideToggle();
		$allStoriesList.slideToggle();
		$submitForm.trigger("reset");
	});

	$body.on("click", async function(e) {
		if (currentUser) {
			const $tgt = $(e.target);
			const $closestLi = $tgt.closest("li");
			const storyId = $closestLi.attr("id");

			if ($tgt.hasClass("fas")) {
				await currentUser.removeFavorite(storyId);
				$tgt.closest("i").toggleClass("fas far");
			} else {
				await currentUser.addFavorite(storyId);
				$tgt.closest("i").toggleClass("fas far");
			}
		}
	});

	/**
	 * Log Out Functionality
	 */
	$navLogOut.on("click", function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	});

	/**
	 * Event Handler for Clicking Login
	 */
	$navLogin.on("click", function() {
		// Show the Login and Create Account Forms
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.slideToggle();
	});

	$navSubmit.on("click", function() {
		if (currentUser) {
			hideElements();
			$submitForm.slideToggle();
		}
	});

	/**
	 * Event handler for Navigation to Homepage
	 */
	$body.on("click", "#nav-all", async function() {
		hideElements();
		await generateStories();
		$allStoriesList.slideToggle();
	});

	$body.on("click", "#nav-favorites", function() {
		hideElements();
		if (currentUser) {
			generateFavorites();
			$favoritedArticles.slideToggle();
		}
	});

	$body.on("click", "#nav-my-stories", function() {
		hideElements();
		if (currentUser) {
			generateMyStories();
			$ownStories.show();
		}
	});

	$ownStories.on("click", ".trash-can", async function(e) {
		const $tgt = $(e.target);
		const $closestLi = $tgt.closest("li");
		const storyId = $closestLi.attr("id");

		await storyList.removeStory(currentUser, storyId);
		await generateStories();
		hideElements();
		$allStoriesList.slideToggle();
	});

	/**
	 * On page load, checks local storage to see if the user is already logged in.
	 * Renders page information accordingly.
	 */
	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem("token");
		const username = localStorage.getItem("username");

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		if (currentUser) {
			showNavForLoggedInUser();
		}
	}

	/**
	 * A rendering function to run to reset the forms and hide the login info
	 */
	function loginAndSubmitForm() {
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

		// reset those forms
		$loginForm.trigger("reset");
		$createAccountForm.trigger("reset");

		// show the stories
		$allStoriesList.slideToggle();

		// update the navigation bar
		showNavForLoggedInUser();
	}

	/**
	 * A rendering function to call the StoryList.getStories static method,
	 *  which will generate a storyListInstance. Then render it.
	 */
	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const result = generateStoryHTML(story);
			$allStoriesList.append(result);
		}
	}

	/**
	 * A function to render HTML for an individual Story instance
	 */
	function generateStoryHTML(story, isOwnStory) {
		let hostName = getHostName(story.url);
		let starType = isFavorite(story) ? "fas" : "far";

		// render story markup
		const trashcanIcon = isOwnStory
			? `<span class="trash-can"><i class="fas fa-trash-alt"></i></span>`
			: "";

		const storyMarkup = $(`
            <li id="${story.storyId}">
              ${trashcanIcon}
              <span class="star">
                  <i class="${starType} fa-star"></i>
              </span>
              <a class="article-link" href="${story.url}" target="a_blank">
                <strong>${story.title}</strong>
              </a>
              <small class="article-author">by ${story.author}</small>
              <small class="article-hostname">(${hostName})</small>
              <small class="article-username">posted by ${story.username}</small>
            </li>
          `);
		return storyMarkup;
	}

	function generateFavorites() {
		$favoritedArticles.empty();
		if (currentUser.favorites.length === 0) {
			$favoritedArticles.append("<h5>No favorites added!</h5>");
		} else {
			for (let story of currentUser.favorites) {
				let favoriteHTML = generateStoryHTML(story, false);
				$favoritedArticles.append(favoriteHTML);
			}
		}
	}

	function generateMyStories() {
		$ownStories.empty();
		if (currentUser.ownStories.length === 0) {
			$ownStories.append("<h5>No stories added by user yet!</h5>");
		} else {
			for (let story of currentUser.ownStories) {
				let ownStoryHTML = generateStoryHTML(story, true);
				$ownStories.append(ownStoryHTML);
			}
		}
		$ownStories.slideToggle();
	}

	/* hide all elements in elementsArr */
	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$favoritedArticles,
			$userProfile
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	function showNavForLoggedInUser() {
		$navLogin.hide();
		$userProfile.hide();
		$(".main-nav-links").toggleClass("hidden");
		$navUserProfile.text(`${currentUser.username}`);
		$navWelcome.slideToggle();
		$navLogOut.slideToggle();
	}

	function isFavorite(story) {
		let favStoryIds = new Set();
		if (currentUser) {
			favStoryIds = new Set(
				currentUser.favorites.map((obj) => obj.storyId)
			);
		}
		return favStoryIds.has(story.storyId);
	}

	/* simple function to pull the hostname from a URL */
	function getHostName(url) {
		let hostName;
		if (url.indexOf("://") > -1) {
			hostName = url.split("/")[2];
		} else {
			hostName = url.split("/")[0];
		}
		if (hostName.slice(0, 4) === "www.") {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	/* sync current user information to localStorage */
	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem("token", currentUser.loginToken);
			localStorage.setItem("username", currentUser.username);
		}
	}
});

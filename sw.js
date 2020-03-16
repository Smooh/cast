"use strict";

// Change this value to force the browser to install the
// service worker again, and recreate the cache (this technique
// works because the browser reinstalls the service worker
// whenever it detects a change in the source code of the
// service worker).
const CACHE_PREFIX = "smooh-cast-static-cache";
const CACHE_VERSION = "-v1";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

self.addEventListener("install", (event) => {
	// skipWaiting() will force the browser to start using
	// this version of the service worker as soon as its
	// installation finishes.
	// It does not really matter when we call skipWaiting(),
	// as long as we perform all other operations inside
	// event.waitUntil(). Calling event.waitUntil() forces
	// the installation process to be marked as finished
	// only when all promises passed to waitUntil() finish.

	self.skipWaiting();

	event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
		// According to the spec, the service worker file
		// is handled differently by the browser and needs
		// not to be added to the cache. I tested it and I
		// confirm the service worker works offline even when
		// not present in the cache (despite the error message
		// displayed by the browser when trying to fetch it).
		//
		// Also, there is no need to worry about max-age and
		// other cache-control headers/settings, because the
		// CacheStorage API ignores them.
		//
		// Nevertheless, even though CacheStorage API ignores
		// them, tests showed that a in few occasions, when
		// the browser was fetching these files, the file
		// being added to the cache actually came from the
		// browser's own cache... Therefore, I switched from
		// cache.addAll() to this.
		const files = [
			"/cast/",
			"/cast/manifest.json",
			"/android-icon-144x144.png",
			"/favicon.ico",
			"/favicon.png",
			"/favicon-32x32.png",
			"/Home/BannerBlur.jpg",
			"/Home/LogoIconeLetras100_.png",
			"/Images/loading-grey-t.gif",
			"/Scripts/bootstrap-1.0.0.min.js",
			"/Scripts/jquery-1.0.1.min.js",
			"/Scripts/main.js",
			"/Styles/bootstrap-1.0.22.min.css",
			"/Styles/font-awesome-1.0.2.min.css"
		];
		const promises = new Array(files.length);
		for (let i = files.length - 1; i >= 0; i--)
			promises.push(cache.add(new Request(files[i], { cache: "no-store" })));
		return Promise.all(promises);
	}));
});

self.addEventListener("activate", (event) => {
	// claim() is used to ask the browser to use this instance
	// of the service worker with all possible clients, including
	// any pages that might have been opened before this service
	// worker was downloaded/activated (not used here).

	self.clients.claim();

	event.waitUntil(
		// List all cache storages in our domain.
		caches.keys().then(function (keyList) {
			// Create one Promise for deleting each cache storage that is not
			// our current cache storage, taking care not to delete other
			// cache storages from the domain by checking the key prefix (we
			// are not using map() to avoid inserting undefined into the array).
			const oldCachesPromises = [];

			for (let i = keyList.length - 1; i >= 0; i--) {
				const key = keyList[i];
				if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
					oldCachesPromises.push(caches.delete(key));
			}

			return Promise.all(oldCachesPromises);
		})
	);
});

function cacheMatch(url, eventRequest) {
	return caches.open(CACHE_NAME).then((cache) => {
		return cache.match(url).then((response) => {
			// Return the resource if it has been found.
			if (response)
				return response;

			// When the resource was not found in the cache,
			// try to fetch it from the network. We are cloning the
			// request because requests are streams, and fetch will
			// consume this stream, rendering event.request unusable
			// (but we will need a usable request later, for cache.put)
			return fetch(eventRequest.clone()).then((response) => {
				// If this fetch succeeds, store it in the cache for
				// later! (This means we probably forgot to add a file
				// to the cache during the installation phase)

				// Just as requests, responses are streams and we will
				// need two usable streams: one to be used by the cache
				// and one to be returned to the browser! So, we send a
				// clone of the response to the cache.
				if (response && response.status === 200)
					cache.put(eventRequest, response.clone());
				return response;
			}, () => {
				// The resource was not in our cache and was not available
				// from the network either...
				// Unfortunately, there is nothing else we can do :(
				return null;
			});
		});
	});
}

self.addEventListener("fetch", (event) => {

	const url = event.request.url;

	// Try to always use a fresh copy of the main pages
	if (url.endsWith("/cast/")) {
		event.respondWith(fetch(event.request).then((response) => {
			return response || cacheMatch(url, event.request);
		}, () => {
			return cacheMatch(url, event.request);
		}));
		return;
	}

	event.respondWith(cacheMatch(url, event.request));

});

// References:
// https://developers.google.com/web/fundamentals/primers/service-workers/?hl=en-us
// https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle?hl=en-us
// https://developers.google.com/web/fundamentals/codelabs/offline/?hl=en-us
// https://web.dev/service-workers-cache-storage

/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSessionStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSessionManager.sys.mjs"
);

// gh-7212: when the same tab is synced across more than one window, collecting
// the session must keep the copy that still has its loaded history. A copy that
// was just synced into another window can momentarily report empty entries, and
// letting that copy win used to drop the user's logged-in pages from every
// window on the next restore.

const SYNC_ID = "1700000000000-42";

const loadedCopy = active => ({
  zenSyncId: SYNC_ID,
  _zenIsActiveTab: active,
  entries: [{ url: "https://example.com/" }],
});

const unflushedCopy = active => ({
  zenSyncId: SYNC_ID,
  _zenIsActiveTab: active,
  entries: [],
});

function collectedUrl(windows) {
  const tabs = ZenSessionStore.collectUsedTabs(windows);
  Assert.equal(tabs.length, 1, "The synced tab is collected exactly once");
  const entries = tabs[0].entries || [];
  return entries.length ? entries[entries.length - 1].url : null;
}

add_task(function test_LoadedCopyWinsOverEmptyActiveCopy() {
  // The active copy lives in the first window but has not flushed its state yet.
  Assert.equal(
    collectedUrl([
      { tabs: [unflushedCopy(true)] },
      { tabs: [loadedCopy(false)] },
    ]),
    "https://example.com/",
    "An empty active copy must not overwrite the loaded one (active seen first)"
  );
  // Same situation, reversed collection order.
  Assert.equal(
    collectedUrl([
      { tabs: [loadedCopy(false)] },
      { tabs: [unflushedCopy(true)] },
    ]),
    "https://example.com/",
    "An empty active copy must not overwrite the loaded one (loaded seen first)"
  );
});

add_task(function test_RealUrlWinsOverAboutBlankPlaceholder() {
  const aboutBlank = active => ({
    zenSyncId: SYNC_ID,
    _zenIsActiveTab: active,
    entries: [{ url: "about:blank" }],
  });
  Assert.equal(
    collectedUrl([
      { tabs: [aboutBlank(true)] },
      { tabs: [loadedCopy(false)] },
    ]),
    "https://example.com/",
    "An about:blank placeholder must not overwrite a loaded copy"
  );
});

add_task(function test_ActiveCopyStillWinsWhenBothLoaded() {
  // When both copies are intact we keep the previous behaviour and favour the
  // active one, so a freshly navigated tab still takes precedence.
  const tabs = ZenSessionStore.collectUsedTabs([
    { tabs: [loadedCopy(false)] },
    { tabs: [loadedCopy(true)] },
  ]);
  Assert.equal(tabs.length, 1, "The synced tab is collected exactly once");
  Assert.ok(
    tabs[0]._zenIsActiveTab,
    "The active copy is kept when both copies are loaded"
  );
});

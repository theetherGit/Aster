# Manual accessibility script

Run by a human. Claude Code must never run, simulate or "verify" this; it is what makes the accessibility claims in the README true. Run it at the end of M2.1, M2.3, M2.4, M2.5 and before every tag — once keyboard-only, once with a screen reader (VoiceOver on macOS, NVDA on Windows). Tick it in the PR template.

1. Open the site cold. Tab from the address bar: the first stop is a skip link, the second is a real control. Nothing is skipped, nothing is focused twice.
2. `⌘N`. Create the lab's class diagram from an empty canvas using only the keyboard: at least five classes, one interface, one enum, every relationship kind at least once, multiplicities on two ends. Note every moment you wanted the mouse.
3. With the screen reader on, do step 2 again from the Outline alone with the canvas collapsed. Every action must be announced in a sentence you would accept from a colleague reading over your shoulder.
4. Switch to the Text view, change a multiplicity and add a class in text, return to the canvas; confirm both changes are there and announced.
5. Save as `.mdj`, open it in StarUML on a lab PC, move one class, save, reopen in Aster. Only the move changed.
6. Export PNG at 2× and paste it into a document; confirm it is sharp and the grid is absent.
7. Switch to high contrast, then to Classic layout, then to 200% browser zoom; repeat step 2 for two classes and one relationship in that state.
8. Turn on reduced motion in the OS; confirm nothing animates.
9. Unplug the network, reload, and confirm the project is there and editable.

Record the date, OS, browser, screen reader and the step numbers that failed in `docs/accessibility-audit.md`. A slice is not done while any step fails.

| Date | OS / browser | Screen reader | Steps run | Failed | Notes |
| ---- | ------------ | ------------- | --------- | ------ | ----- |
|      |              |               |           |        |       |

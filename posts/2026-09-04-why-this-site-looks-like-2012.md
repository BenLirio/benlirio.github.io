---
title: Why this site looks like 2012
date: 2026-09-04
---

For a few years this site was a table. Date, a one-to-five rating of whether the thing worked, a name, a demo link, a GitHub link. Verdana on gray. I never minded it much. It was honest.

What I did mind, when I finally sat down to redo it, was the risk of it turning into a resume. Every template I looked at wanted a skills grid, an experience section, a bio in the third person, a button that says "let's work together." I would rather keep the gray table than send someone that.

The other thing I kept bumping into was how clean everything is now. White page, Inter, a lot of whitespace, one accent color. It looks good. It also looks like everyone, and none of it feels like arriving anywhere. The one personal site I actually liked, [tom7.org](http://tom7.org/), feels like a portal into an old UI. His old UI is 1998, though, and I was born in 1999. It is not my nostalgia.

Mine is the first iPhone. I was eight when it came out and thirteen when iOS 6 shipped, and then in 2013 iOS 7 flattened everything. So that is what this site is: an iPhone 5 running iOS 6. A lock screen you slide to unlock, a home screen you swipe through, a dock, apps that zoom open. On a desktop you get the whole phone. On an actual phone the screen is just the screen.

It turned out to fit the content better than I expected. Most of what I make are small interactive toys, and a home screen of glossy icons you can tap is exactly what they are. The old table survives as the Projects app, a grouped list with a status word instead of the star rating. The demos run inside the phone.

## The line

The home screen has two pages. The first is things made with AI. The second is things made by hand, roughly before 2023. The Projects app draws the same line, with a sentence about it where the two sections meet.

I drew it because the projects on either side are different kinds of objects now. An AI could produce most of the pre-2023 ones almost instantly. That makes them technically uninteresting today, but they are still cool artifacts, and they took real effort at the time, so they stay. The Projects app performs the split a little: the "with AI" section is flat, iOS 7 style, and the "by hand" section is glossy iOS 6. Skeuomorphism was laborious. Flat was fast. That is not a bad picture of what changed.

## How it is built

No framework. One JSON file for the projects, markdown files for posts, and a build script that uses nothing outside Node's standard library, so it should still run untouched in a few years. The phone is one hand-written stylesheet and one script with no dependencies. The icons are screenshots of the live demos, cropped by a small script that drives Chrome. An AI maintains most of it, including this first draft, from notes I wrote. That seemed like the right way to build a site that has a line drawn at 2023 in it.

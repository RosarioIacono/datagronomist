---
title: "Seeds, Code, and What We Pass Down"
date: 2025-03-09
draft: false
description: "A few weeks before my son is born, I've been building a small automated growing system in the cellar. It's made me think about open source, anonymous generosity, and what my father didn't teach me."
tags: ["open source", "mycodo", "tasmota", "personal", "growing"]
author: "Rosario Iacono"

cover:
  image: "cover.jpg"          # place your photo at: content/posts/seeds-code-what-we-pass-down/cover.jpg
  alt: "Raspberry Pi and BME688 sensor next to seedling trays in a cellar growing setup"
  caption: "The cellar setup — Raspberry Pi 4B, BME688, and the first seedlings of the season"
  relative: true               # keeps the image path relative to the post folder
  hiddenInList: false          # shows cover in post list too
---

My son will be born in a few weeks.

In the meantime, I've been spending evenings in the cellar, setting up a small automated growing system. A Raspberry Pi running [Mycodo](https://kylegabriel.com/projects/2020/06/flask-mega-tutorial.html), a BME688 sensor tracking temperature, humidity, pressure and air quality, a handful of [Tasmota](https://tasmota.github.io/docs/) smart plugs controlling the lights, a heater, and a humidifier. I'm starting this year's garden seedlings from down there, in the dark, before spring arrives.

It's a modest setup. But building it has felt significant in a way I didn't fully expect.

## The wall, and what it made me think

I've been following Mycodo and its creator for a while — reading the documentation, watching the community grow, waiting until I felt settled enough to actually build something with it. Then I hit a wall: Mycodo needed extra dependencies because Python and other things had changed, and the installation wasn't straightforward anymore. I spent time troubleshooting, going through it step by step. And somewhere in that process I realised — I could document this. I could help the people who will hit the same wall next month.

That's what open source does to you, if you let it. It turns users into contributors.

Both Mycodo and Tasmota are striking examples of this. Projects built by people who are largely unknown and unglamorous, working out of love for the craft and the community. No marketing. No brand. Just knowledge, made freely available. They quietly power thousands of growing systems, smart homes, and tinkerer setups around the world — and most users will never know the names of the people who built them.

That feels like something worth thinking about, in a week like this one.

## What my father didn't teach me

My father was a farmer. He knew things about soil and seasons and living systems that I will never fully know, because he never quite found the time to teach me. That knowledge lived in his hands, and some of it stayed there.

I don't say this with bitterness. He was busy. Life is busy. But I think about it now, in a different way than I used to.

When my son is five or six — maybe older — I'd like to sit with him in that cellar and show him what the BME688 is reading. Explain why the humidity matters for a seedling in its first days. Let him write a small piece of code that turns a light on. Not to make him a programmer or a scientist. Just to show him that the world is made of knowable things, and that knowing them is something you can do with your hands.

The open source community already understands this instinctively. Every README, every forum reply, every documented workaround is someone saying: *I figured this out, and I don't want you to have to start from zero*. It's knowledge kept alive and passed forward — the same gesture my father made with his land, when he did make it.

## The seedlings don't care

The seedlings don't care about any of this. They just grow toward the light, the way they always have.

But I think building this system was, in some way, for him.

---

*If you're setting up Mycodo on a Raspberry Pi 4B with Python 3.13 and running into dependency issues, I'm planning a follow-up post with the exact steps that worked for me. [Let me know](mailto:your@email.com) if that would be useful.*

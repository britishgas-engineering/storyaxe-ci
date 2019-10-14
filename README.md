# Storyaxe-ci

👋 Hello! Let's get some accessibility tests running in your CI!

## About

If you are using Storybook and care about accessibility, then this is for you!
Don't rely on developers (or yourself 🙊) to add accessibility tests for their components. Have it
always run in your CI.

This uses the awesome package `axe-core`. Learn more about it at their website: https://www.deque.com/axe/

## Setup

In your repository:

```
$ npm i --save-dev storyaxe-ci
```

In your test script (or which ever script you want) add:

```
storyaxe --input ./dist/demo/iframe.html
```

## Usage

For this to work there needs to be a location of Storybook. It can be either static or served.

To run storyaxe-ci:

```
storyaxe
```

It will default to look for Storybook at `http://localhost:9001/iframe.html`. You can change this two ways:

### Options

- input
- localhost

If you are using the static version of Storybook, use `input`:

```
storyaxe --input ./dist/demo/iframe.html
```

If you are using the served version of Storybook use `localhost`:

```
storyaxe --localhost http://localhost:8080/iframe.html
```


#### Changing browser args

You can pass a parameter of `opts` to change the browser arguments.

These will default as `['--no-sandbox', '--disable-setuid-sandbox']`

```
storyaxe --opts ['--no-sandbox', '--disable-setuid-sandbox']
```

> It should always point to the `iframe.html`

## Contributions

If you found any issues or can see something you can make better. Please write an issue or create a PR, thanks! 🚀

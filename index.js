#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import axeCore from 'axe-core';
import parseArgs from 'minimist';
import colors from 'colors';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const opts = args.opts && args.opts.replace('[', '').replace(']', '').split(',') || ['--no-sandbox', '--disable-setuid-sandbox'];

let localhost = args.input || args.localhost || 'http://localhost:9001/iframe.html';

if (args.input) {
  localhost = `file://${path.join(process.cwd(), localhost)}`;
}

const unknownError = (e) => {
  console.error('Something went wrong, please make sure storybook is running or is pointed to the right location.'.red);
  console.error(e);
  process.exit(1);
}

const logger = (story, violation) => {
  const name = `${story.kind}: ${story.name}`;

  if (violation) {
    const {description, helpUrl, nodes} = violation;

    console.error(
      `
      ${name}
      `.cyan,
      `  ${violation.description}\n`.red,
      `  Please check:`.red, `${violation.helpUrl}\n`.red,
      `  ${violation.nodes[0].failureSummary}`.red
    );
  } else {
    console.log(
      `
      ${name}
      `.cyan,
      '  All accessibility checks passed'.green
    );
  }
};

const getStorybook = async (browser, url) => {
  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: 'networkidle2'
  });

  const evaluate = await page.evaluate('__STORYBOOK_CLIENT_API__.getStorybook()');
  await page.close();

  return evaluate;
};

const getStories = async (browser, components) => {
  return components.map((component) => {
    const kind = component.kind;

    return component.stories.map((story) => {
      const name = story.name;
      return {
        url: `${localhost}?selectedKind=${kind}&selectedStory=${name}`,
        kind,
        name
      };
    })
  });
};

(async () => {
  const browser = await puppeteer.launch({args: opts}).catch((e) => unknownError(e));
  const components = await getStorybook(browser, localhost).catch((e) => unknownError(e));
  const stories = await getStories(browser, components);
  let errors = [];

  await browser.close();

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 10,
  });

  const allStories = stories.reduce((all, value) => {
    return all.concat(value);
  }, []);

  await cluster.task(async ({ page, data }) => {
    const {url} = data;

    try {

      await page.goto(url, {waitUntil:  'networkidle2'});

      const handle = await page.evaluateHandle(`
        const wrapper = document.getElementById('root');
    		${axeCore.source}
    		axe.run(wrapper)
    	`);

      const results = await handle.jsonValue();

      await handle.dispose();
      await page.close();

      if (results.violations.length < 1) {
        logger(data);
      }

      results.violations.forEach((violation) => {
        errors.push(violation);
        logger(data, violation);
      });

    } catch (err) {
      throw err;
    }
  });

  for (const storyObj of allStories) {
    cluster.queue(storyObj);
  }

  await cluster.idle();
  await cluster.close();

  if (errors.length > 0) {
    console.error(`\n${errors.length} accessibility tests failed`.underline.red);
    process.exit(1);
  } else {
    console.log(`\nAll accessibility tests passed`.underline.green);
    process.exit(0);
  }
})();

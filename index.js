#!/usr/bin/env node
import puppeteer from 'puppeteer';
import axeCore from 'axe-core';
import parseArgs from 'minimist';
import colors from 'colors';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const opts = args.opts || ['--no-sandbox', '--disable-setuid-sandbox'];

let localhost = args.input || args.localhost || 'http://localhost:9001/iframe.html';

if (args.input) {
  localhost = `file://${path.join(process.cwd(), localhost)}`;
}

const unknownError = (e) => {
  console.error('Something went wrong, please make sure storybook is running or is pointed to the right location.'.red);
  console.error(e);
  process.exit(1);
}

const runAxeOnPage = async (browser, url) => {
  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle2'
    });

    const handle = await page.evaluateHandle(`
      const wrapper = document.getElementById('root');
  		${axeCore.source}
  		axe.run(wrapper)
  	`);

    const results = await handle.jsonValue();

  	await handle.dispose();
    await page.close();

  	return results;
  }  catch (err) {
		if (browser) {
			await browser.close();
		}
		throw err;
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

  const allStories = stories.reduce((all, value) => {
    return all.concat(value);
  }, []);

  try {
    for (const storyObj of allStories) {
      console.log(`\n${storyObj.kind}: ${storyObj.name} \n`.cyan);
      const bar = await runAxeOnPage(browser, storyObj.url).catch((e) => unknownError(e));

      if (bar.violations.length < 1) {
        console.log('  All accessibility checks passed'.green);
      }
      bar.violations.forEach((violation) => {
        errors.push(violation);
        console.error(`  ${violation.description}`.red);
        console.info(`  Please check:`.red, `${violation.helpUrl}`.red);
        console.info(`  ${violation.nodes[0].failureSummary}`.red);
      });
    }
  } catch (err) {
		if (browser) {
			await browser.close();
		}
		throw err;
	}

  await browser.close();

  if (errors.length > 0) {
    console.error(`\n${errors.length} accessibility tests failed`.underline.red);
    process.exit(1);
  } else {
    console.log(`\nAll accessibility tests passed`.underline.green);
    process.exit(0);
  }
})();

#!/usr/bin/env node
import { Command } from 'commander'
import { JuheClient } from './client.js'

const program = new Command()

program.name('juhe').description('Juhe Management CLI').version('0.1.0')

function createClient(url: string, token?: string, key?: string) {
  return new JuheClient({ baseURL: url, adminToken: token, apiKey: key })
}

function output(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
  } else {
    console.error(`Error: ${String(error)}`)
  }
  process.exit(1)
}

program
  .command('login')
  .description('Login and get JWT token')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('--username <username>', 'Username')
  .requiredOption('--password <password>', 'Password')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url)
      const result = await client.login({ username: opts.username, password: opts.password })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('keys:list')
  .description('List API keys')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-t, --token <token>', 'Admin JWT token')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <size>', 'Page size', '20')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, opts.token)
      const result = await client.listTokens(Number(opts.page), Number(opts.pageSize))
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('keys:create')
  .description('Create an API key')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-t, --token <token>', 'Admin JWT token')
  .requiredOption('-n, --name <name>', 'Key name')
  .option('-q, --quota <quota>', 'Remaining quota', '0')
  .option('--unlimited', 'Unlimited quota', false)
  .option('-g, --group <group>', 'Group')
  .option('-m, --models <models>', 'Comma-separated model limits')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, opts.token)
      const result = await client.createToken({
        name: opts.name,
        remain_quota: Number(opts.quota),
        unlimited_quota: opts.unlimited,
        group: opts.group,
        model_limits: opts.models
          ? opts.models
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('keys:delete')
  .description('Delete an API key')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-t, --token <token>', 'Admin JWT token')
  .requiredOption('-i, --id <id>', 'Key ID')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, opts.token)
      await client.deleteToken(Number(opts.id))
      console.log('deleted')
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('chat')
  .description('Send a chat completion request')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('--model <model>', 'Model name')
  .requiredOption('-m, --message <message>', 'User message')
  .option('--temperature <temperature>', 'Temperature')
  .option('--max-tokens <maxTokens>', 'Max tokens')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.chatCompletions({
        model: opts.model,
        messages: [{ role: 'user', content: opts.message }],
        temperature: opts.temperature !== undefined ? Number(opts.temperature) : undefined,
        max_tokens: opts.maxTokens !== undefined ? Number(opts.maxTokens) : undefined
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('image')
  .description('Generate images')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('--model <model>', 'Model name')
  .requiredOption('-p, --prompt <prompt>', 'Prompt')
  .option('-n, --count <count>', 'Number of images', '1')
  .option('--size <size>', 'Image size')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.createImage({
        model: opts.model,
        prompt: opts.prompt,
        n: Number(opts.count),
        size: opts.size
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('quota')
  .description('Query quota')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.getQuota()
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('prompts:list')
  .description('List public prompts')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .option('--type <type>', 'Prompt type: image | agent | package', 'image')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <size>', 'Page size', '20')
  .option('--keyword <keyword>', 'Keyword')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listPrompts(opts.type, {
        page: Number(opts.page),
        page_size: Number(opts.pageSize),
        keyword: opts.keyword
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('prompts:render')
  .description('Render a prompt')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('-i, --id <id>', 'Prompt ID')
  .option('-v, --vars <vars...>', 'Variables as key=value')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const variables: Record<string, string> = {}
      if (opts.vars) {
        for (const pair of opts.vars) {
          const idx = pair.indexOf('=')
          if (idx > 0) {
            variables[pair.slice(0, idx)] = pair.slice(idx + 1)
          }
        }
      }
      const result = await client.renderPrompt(Number(opts.id), variables)
      output({ content: result })
    } catch (error) {
      handleError(error)
    }
  })

program.parse()

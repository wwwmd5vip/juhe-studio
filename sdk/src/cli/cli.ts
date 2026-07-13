#!/usr/bin/env node
import { Command } from 'commander'
import { JuheClient } from '../core/client.js'

const program = new Command()

program.name('juhe').description('Juhe Management CLI').version('0.1.0')

function createClient(url: string, token?: string, key?: string) {
  return new JuheClient({ baseURL: url, adminToken: token, apiKey: key })
}

function output(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

function safeInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue
  const n = Number(value)
  return Number.isNaN(n) ? defaultValue : n
}

function safeNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

/** Mask sensitive fields in output for specific commands */
function outputSafe(data: unknown, command: string): void {
  if (typeof data !== 'object' || data === null) {
    output(data)
    return
  }
  const d = JSON.parse(JSON.stringify(data)) as Record<string, unknown>
  const maskFields: Record<string, string[]> = {
    login: ['token'],
    'keys:create': ['key'],
  }
  const fields = maskFields[command]
  if (fields) {
    for (const f of fields) {
      if (typeof d[f] === 'string' && (d[f] as string).length > 8) {
        d[f] = (d[f] as string).slice(0, 8) + '****'
      }
    }
  }
  console.log(JSON.stringify(d, null, 2))
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
      outputSafe(result, 'login')
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
      const result = await client.listTokens(safeInt(opts.page, 1), safeInt(opts.pageSize, 20))
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
        remain_quota: safeInt(opts.quota, 0),
        unlimited_quota: opts.unlimited,
        group: opts.group,
        model_limits: opts.models ? opts.models.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      })
      outputSafe(result, 'keys:create')
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
      await client.deleteToken(safeInt(opts.id, 0))
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
        temperature: safeNum(opts.temperature),
        max_tokens: safeNum(opts.maxTokens),
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
        n: safeInt(opts.count, 1),
        size: opts.size,
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
        page: safeInt(opts.page, 1),
        page_size: safeInt(opts.pageSize, 20),
        keyword: opts.keyword,
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
      const result = await client.renderPrompt(safeInt(opts.id, 0), variables)
      output({ content: result })
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('topup:create')
  .description('Create a top-up order')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .option('-p, --package-id <id>', 'Quota package ID')
  .option('-a, --amount-cents <amount>', 'Amount in cents')
  .option('-m, --payment-method <method>', 'Payment method')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.createTopUp({
        package_id: opts.packageId ? safeInt(opts.packageId, 0) : undefined,
        amount_cents: opts.amountCents ? safeInt(opts.amountCents, 0) : undefined,
        payment_method: opts.paymentMethod,
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('redeem')
  .description('Redeem a code')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('-c, --code <code>', 'Redemption code')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.redeemCode(opts.code)
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('packages:list')
  .description('List available quota packages')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listQuotaPackages()
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('transactions:list')
  .description('List quota transactions')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <size>', 'Page size', '20')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listQuotaTransactions(safeInt(opts.page, 1), safeInt(opts.pageSize, 20))
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('bills:daily')
  .description('List daily bills')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('--start-date <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end-date <date>', 'End date (YYYY-MM-DD)')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <size>', 'Page size', '20')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listMyDailyBills({
        start_date: opts.startDate,
        end_date: opts.endDate,
        page: safeInt(opts.page, 1),
        page_size: safeInt(opts.pageSize, 20),
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('bills:monthly')
  .description('List monthly bills')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('--start-month <month>', 'Start month (YYYY-MM)')
  .requiredOption('--end-month <month>', 'End month (YYYY-MM)')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <size>', 'Page size', '20')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listMyMonthlyBills({
        start_month: opts.startMonth,
        end_month: opts.endMonth,
        page: safeInt(opts.page, 1),
        page_size: safeInt(opts.pageSize, 20),
      })
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('plans:list')
  .description('List available subscription plans')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listSubscriptionPlans()
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('subscribe')
  .description('Subscribe to a plan')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('-p, --plan-id <id>', 'Subscription plan ID')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.subscribe(opts.planId)
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('subscribe:cancel')
  .description('Cancel a subscription')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .requiredOption('-i, --id <id>', 'Subscription ID')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      await client.cancelSubscription(safeInt(opts.id, 0))
      console.log('cancelled')
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('subscriptions:list')
  .description('List my subscriptions')
  .requiredOption('-u, --url <url>', 'Server base URL')
  .requiredOption('-k, --key <key>', 'API key')
  .action(async (opts) => {
    try {
      const client = createClient(opts.url, undefined, opts.key)
      const result = await client.listMySubscriptions()
      output(result)
    } catch (error) {
      handleError(error)
    }
  })

program.parse()

import { test, expect } from '@playwright/test'

test('create a secret, reveal it once, then it is burned', async ({ page, context }) => {
  await page.goto('/')
  await page.getByLabel(/secret/i).fill('correct horse battery staple')
  await page.getByRole('button', { name: /create link/i }).click()

  const linkField = page.getByLabel(/share this link/i)
  await expect(linkField).toBeVisible()
  const link = await linkField.inputValue()
  expect(link).toContain('/s/')
  expect(link).toContain('#')

  // Recipient opens the link in a fresh page and reveals.
  const recipient = await context.newPage()
  await recipient.goto(link)
  await recipient.getByRole('button', { name: /reveal/i }).click()
  await expect(recipient.getByLabel(/revealed secret/i)).toHaveText(
    'correct horse battery staple',
  )

  // Reloading shows the secret is gone (burned).
  await recipient.reload()
  await expect(recipient.getByRole('alert')).toBeVisible()
})

test('a link-preview GET (peek) does not burn the secret', async ({ page, context, request }) => {
  await page.goto('/')
  await page.getByLabel(/secret/i).fill('preview safe')
  await page.getByRole('button', { name: /create link/i }).click()

  const link = await page.getByLabel(/share this link/i).inputValue()
  const id = link.split('/s/')[1]?.split('#')[0] ?? ''

  // Simulate a messaging client prefetching the link (a bare GET).
  const preview = await request.get(`/api/secrets/${id}`)
  expect(preview.status()).toBe(200)

  // The human recipient can still reveal it.
  const recipient = await context.newPage()
  await recipient.goto(link)
  await recipient.getByRole('button', { name: /reveal/i }).click()
  await expect(recipient.getByLabel(/revealed secret/i)).toHaveText('preview safe')
})

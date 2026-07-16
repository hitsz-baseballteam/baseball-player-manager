import { NextResponse } from "next/server";
import type { Resend } from "resend";

let _client: Resend | null | undefined;

async function resendClient(): Promise<Resend | null> {
	if (_client === undefined) {
		const key = process.env.RESEND_API_KEY;
		if (!key) {
			_client = null;
		} else {
			const { Resend: R } = await import("resend");
			_client = new R(key);
		}
	}
	return _client;
}

export async function POST(request: Request) {
	let event: { type: string; data?: { email_id?: string } };
	try {
		event = await request.json();
	} catch {
		return NextResponse.json({ error: "invalid_json" }, { status: 400 });
	}

	if (event.type !== "email.received" || !event.data?.email_id) {
		return NextResponse.json({ ok: true });
	}

	const resend = await resendClient();
	if (!resend) {
		console.error("inbound: RESEND_API_KEY not configured");
		return NextResponse.json({ error: "not_configured" }, { status: 500 });
	}

	const { data: email, error } = await resend.emails.receiving.get(
		event.data.email_id,
	);
	if (error || !email) {
		console.error("inbound: failed to fetch email", error);
		return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
	}

	const { error: sendErr } = await resend.emails.send({
		from: "hi@hitsz-baseball.online",
		to: "zzzzorange33@gmail.com",
		subject: `[棒球队咨询] ${email.subject || "(无主题)"}`,
		html: [
			`<p><strong>发件人:</strong> ${escHtml(email.from)}</p>`,
			`<p><strong>主题:</strong> ${escHtml(email.subject || "(无主题)")}</p>`,
			"<hr>",
			email.html ?? `<pre>${escHtml(email.text ?? "(无内容)")}</pre>`,
		].join("\n"),
	});

	if (sendErr) {
		console.error("inbound: failed to forward email", sendErr);
		return NextResponse.json({ error: "forward_failed" }, { status: 502 });
	}

	return NextResponse.json({ ok: true });
}

function escHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

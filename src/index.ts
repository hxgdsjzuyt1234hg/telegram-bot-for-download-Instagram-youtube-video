import { Telegraf, Context, Markup, session } from "telegraf";
import * as ytdl from "ytdl-core";
import { createWriteStream, unlinkSync, promises as fsPromises } from "fs";
import { resolve } from "path";
import { getInstagramDownloadLink } from "./utils/getInstagramVideo";

// Replace with your bot token and channel usernames
const BOT_TOKEN = "7963707647:AAEnsNEurz2B6d52Eqiyx94dUWz7uNmlzjQ";
const CHANNEL_1 = "@mydemochannel001"; // https://t.me/mydemochannel001
const CHANNEL_2 = "@mydemochannel002"; // https://t.me/mydemochannel002

interface MySession {
  url: string;
}

interface MyContext extends Context {
  session: MySession;
}

const bot = new Telegraf<MyContext>(BOT_TOKEN);

// Middleware to handle sessions
bot.use(session());

bot.use(async (ctx, next) => {
  // Initialize session if it doesn't exist
  ctx.session = ctx.session || {};
  await next();
});

// Check if user is a member of both channels
async function checkMembership(ctx: Context): Promise<boolean> {
  try {
    const userId = ctx.from?.id;

    if (!userId) return false;

    // Check membership in CHANNEL_1
    const member1 = await ctx.telegram.getChatMember(CHANNEL_1, userId);
    const isMember1 = ["member", "administrator", "creator"].includes(member1.status);

    // Check membership in CHANNEL_2
    const member2 = await ctx.telegram.getChatMember(CHANNEL_2, userId);
    const isMember2 = ["member", "administrator", "creator"].includes(member2.status);

    return (isMember1 && isMember2);
  } catch (error: any) {
    console.error("Membership check error:", error.message);
    return false;
  }
}

// Start command
bot.start(async (ctx) => {
  const isMember = await checkMembership(ctx);

  if (isMember) {
    // Show options if user is already a member
    await showOptions(ctx);
  } else {
    // Ask the user to join the channels
    await showChannelOptions(ctx);
  }
});

bot.on("message", async (ctx, next) => {
  const isMember = await checkMembership(ctx);

  if (!isMember) {
    return await showChannelOptions(ctx);
  }

  // User is a member; proceed to the next middleware or handler
  await next();
});

// Show options to join channel
async function showChannelOptions(ctx: Context) {
  await ctx.reply(`To use this bot, please join the following channels:\n\n1. [Channel 1](${CHANNEL_1})\n2. [Channel 2](${CHANNEL_2})`);
}

// Show options for YouTube and Instagram
async function showOptions(ctx: Context) {
  await ctx.reply("What would you like to download?", {
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Download YouTube Videos", "youtube")],
      [Markup.button.callback("Download Instagram Videos", "instagram")],
    ]),
  });
}

// Handle YouTube option
bot.action("youtube", async (ctx) => {
  await ctx.reply("Please paste your YouTube video link:");
  bot.on("text", async (ctx) => {
    const url = ctx.message?.text;

    if (!ytdl.validateURL(url)) {
      return ctx.reply("The provided link is not a valid YouTube URL. Please try again.");
    }

    // Save the URL in the session
    ctx.session.url = url;

    await ctx.reply("Choose an option:", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`Download as Audio`, `yt_audio_url`)],
        [Markup.button.callback(`Download as Video`, `yt_video_url`)],
      ]),
    });
  });
});

// Handle Instagram option
bot.action("instagram", async (ctx) => {
  await ctx.reply("Please paste your Instagram video link:");

  bot.on("text", async (ctx) => {
    const url = ctx.message?.text;

    // Perform Instagram video download here
    try {
      // in the videoLink variable
      const videoLink = await getInstagramDownloadLink(url);
      // if we get a videoLink, send the videoLink back to the user
      if (videoLink) {
        await ctx.sendVideo(videoLink);
      } else {
        throw new Error(`The link you have entered is invalid.`);
      }
    } catch (err) {
      // handle any issues with invalid links
      await ctx.reply(`There is a problem with the link you have provided.`);
    }
  });
});

// Ensure the downloads directory exists and return its resolved path
async function ensureDownloadsDirectory(): Promise<string> {
  const downloadsPath = resolve("./downloads");

  try {
    // Check if the directory exists
    await fsPromises.access(downloadsPath);
  } catch {
    // Directory does not exist, so create it
    await fsPromises.mkdir(downloadsPath, { recursive: true });
  }

  return downloadsPath; // Return the resolved path
}

// Handle YouTube audio download
bot.action(/yt_audio_(.+)/, async (ctx) => {
  const url = ctx?.session?.url;
  console.log("###_url_### ", url);

  try {
    const resolvedDownloadsPath = await ensureDownloadsDirectory(); // Await for the resolved path
    const outputPath = `${resolvedDownloadsPath}/audio_${Date.now()}.mp3`;

    if (!ytdl.validateURL(url)) {
      return await ctx.reply("The provided link is not a valid YouTube URL. Please try again.");
    }

    await ctx.reply("Downloading audio, please wait...");

    const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" })
      .pipe(createWriteStream(outputPath));

    stream.on("finish", async () => {
      await ctx.replyWithAudio({ source: outputPath });
      // unlinkSync(outputPath); // Clean up after sending
    });

    stream.on("error", async (error) => {
      console.error("Stream error:", error);
      await ctx.reply("An error occurred while downloading the audio. Please try again.");
    });
  } catch (error) {
    console.error("YouTube audio download error:", error);
    await ctx.reply("Failed to download audio. Please try again.");
  }
});

// Handle YouTube video download
bot.action(/yt_video_(.+)/, async (ctx) => {
  ensureDownloadsDirectory();

  const url = ctx.match[1];
  const outputPath = resolve(`./downloads/video_${Date.now()}.mp4`);

  try {
    const stream = ytdl(url, { filter: "videoandaudio" }).pipe(createWriteStream(outputPath));

    stream.on("finish", async () => {
      await ctx.replyWithVideo({ source: outputPath });
      unlinkSync(outputPath);
    });

    await ctx.reply("Downloading video, please wait...");
  } catch (error) {
    console.error("YouTube video download error:", error);
    ctx.reply("Failed to download video. Please try again.");
  }
});

// Error handling
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Start the bot
bot.launch();
console.log("Bot is running...");

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
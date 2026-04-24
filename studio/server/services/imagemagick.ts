const { spawnSync } = require("child_process");

function isMissingCommand(result) {
  return result.error && result.error.code === "ENOENT";
}

function spawnImageMagick(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });
}

function runImageMagick(args) {
  const modernResult = spawnImageMagick("magick", args);

  if (!isMissingCommand(modernResult)) {
    if (modernResult.error) {
      throw modernResult.error;
    }

    return modernResult;
  }

  const legacyCommand = args[0] === "compare" ? "compare" : "convert";
  const legacyArgs = args[0] === "compare" ? args.slice(1) : args;
  const legacyResult = spawnImageMagick(legacyCommand, legacyArgs);

  if (isMissingCommand(legacyResult)) {
    throw new Error(`ImageMagick is required. Tried magick and ${legacyCommand}.`);
  }

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return legacyResult;
}

module.exports = {
  runImageMagick
};

using System.IO.Compression;
using System.Text;

namespace PKForge.App.Services;

/// <summary>
/// The app's own diary, kept on the device so a player can send it when something goes
/// wrong: a rolling log of what the app did (screens, saves opened, scans, writes, errors),
/// and a crash report written the moment the app dies from an unhandled error, managed or
/// Java. Nothing leaves the device unless the player shares it from Settings. Every write
/// is guarded: logging can never be the thing that breaks the app.
/// </summary>
public static class AppLog
{
    private const long MaxLogBytes = 1 << 20;   // one file of recent activity, one previous
    private const int MaxCrashReports = 5;
    private const int TailLines = 200;          // recent lines copied into a crash report

    private static readonly Lock Gate = new();
    private static readonly Queue<string> Tail = new();
    private static bool _installed;

    private static string Folder => Path.Combine(FileSystem.AppDataDirectory, "logs");
    private static string CurrentLog => Path.Combine(Folder, "pkforge.log");
    private static string PreviousLog => Path.Combine(Folder, "pkforge.previous.log");

    public static void Info(string area, string message) => Write("INFO", area, message);

    public static void Warn(string area, string message) => Write("WARN", area, message);

    public static void Error(string area, string message, Exception? error = null) =>
        Write("ERROR", area, error is null ? message : $"{message}\n{error}");

    /// <summary>Hooks every way the process can die from an error; call once at startup.</summary>
    public static void Install()
    {
        if (_installed) return;
        _installed = true;
        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            WriteCrash("Unhandled .NET exception", args.ExceptionObject as Exception, args.ExceptionObject?.ToString());
        TaskScheduler.UnobservedTaskException += (_, args) =>
        {
            Error("task", "Unobserved task exception", args.Exception);
            args.SetObserved();
        };
#if ANDROID
        Android.Runtime.AndroidEnvironment.UnhandledExceptionRaiser += (_, args) =>
        {
            // MAUI logs a failed image load through the handler's services. When the image
            // finishes after its window was torn down, getting that logger throws instead:
            // the image is gone with its page, so this is not worth a crash.
            if (args.Exception is ObjectDisposedException { ObjectName: "IServiceProvider" } disposed
                && disposed.StackTrace?.Contains("Microsoft.Maui.TaskExtensions", StringComparison.Ordinal) == true)
            {
                Warn("app", "An image finished loading after its window closed");
                args.Handled = true;
                return;
            }
            WriteCrash("Unhandled exception on the Android main thread", args.Exception, null);
        };
        var previous = Java.Lang.Thread.DefaultUncaughtExceptionHandler;
        Java.Lang.Thread.DefaultUncaughtExceptionHandler = new JavaCrashHandler(previous);
#endif
        Info("app", $"Started · {DeviceSummary()}");
    }

    /// <summary>Crash reports from earlier runs that the player has not been told about yet.</summary>
    public static IReadOnlyList<string> UnseenCrashes()
    {
        try
        {
            return Directory.Exists(Folder)
                ? [.. Directory.EnumerateFiles(Folder, "crash-*.txt").Where(f => !File.Exists(f + ".seen")).Order()]
                : [];
        }
        catch (IOException) { return []; }
    }

    public static void MarkCrashesSeen()
    {
        foreach (var crash in UnseenCrashes())
            TryIo(() => File.WriteAllText(crash + ".seen", DateTimeOffset.Now.ToString("O")));
    }

    /// <summary>
    /// Packs the logs, crash reports, device details and the given extra texts (the scan
    /// report) into one zip in the cache folder, ready for the share sheet.
    /// </summary>
    public static string BuildShareArchive(IReadOnlyDictionary<string, string> extras)
    {
        var path = Path.Combine(FileSystem.CacheDirectory, $"pkforge-logs-{DateTime.Now:yyyyMMdd-HHmmss}.zip");
        lock (Gate)
        {
            using var zip = ZipFile.Open(path, ZipArchiveMode.Create);
            AddText(zip, "device.txt", DeviceDetails());
            if (Directory.Exists(Folder))
            {
                foreach (var file in Directory.EnumerateFiles(Folder).Where(f => !f.EndsWith(".seen", StringComparison.Ordinal)))
                    zip.CreateEntryFromFile(file, Path.GetFileName(file), CompressionLevel.Optimal);
            }
            foreach (var (name, text) in extras)
                AddText(zip, name, text);
        }
        return path;
    }

    private static void AddText(ZipArchive zip, string name, string text)
    {
        using var writer = new StreamWriter(zip.CreateEntry(name, CompressionLevel.Optimal).Open(), Encoding.UTF8);
        writer.Write(text);
    }

    private static void Write(string level, string area, string message)
    {
        var line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff zzz} {level,-5} [{area}] {message}";
#if ANDROID
        if (level == "ERROR") Android.Util.Log.Error("PKForge", line);
        else Android.Util.Log.Info("PKForge", line);
#endif
        lock (Gate)
        {
            Tail.Enqueue(line);
            while (Tail.Count > TailLines) Tail.Dequeue();
            TryIo(() =>
            {
                Directory.CreateDirectory(Folder);
                if (File.Exists(CurrentLog) && new FileInfo(CurrentLog).Length > MaxLogBytes)
                    File.Move(CurrentLog, PreviousLog, overwrite: true);
                File.AppendAllText(CurrentLog, line + "\n");
            });
        }
    }

    private static void WriteCrash(string kind, Exception? error, string? fallback)
    {
        lock (Gate)
        {
            TryIo(() =>
            {
                Directory.CreateDirectory(Folder);
                var report = new StringBuilder()
                    .AppendLine($"PKForge crash report · {DateTimeOffset.Now:O}")
                    .AppendLine(kind)
                    .AppendLine()
                    .AppendLine(DeviceDetails())
                    .AppendLine("── Error ──")
                    .AppendLine(error?.ToString() ?? fallback ?? "(no details)")
                    .AppendLine()
                    .AppendLine("── Recent activity ──");
                foreach (var line in Tail) report.AppendLine(line);
                File.WriteAllText(Path.Combine(Folder, $"crash-{DateTime.Now:yyyyMMdd-HHmmss-fff}.txt"), report.ToString());
                foreach (var old in Directory.EnumerateFiles(Folder, "crash-*.txt").Order().SkipLast(MaxCrashReports))
                {
                    File.Delete(old);
                    File.Delete(old + ".seen");
                }
            });
        }
    }

    private static string DeviceSummary()
    {
#if ANDROID
        return $"PKForge {AppInfo.Current.VersionString} ({AppInfo.Current.BuildString}) · {Android.OS.Build.Manufacturer} {Android.OS.Build.Model} · Android {Android.OS.Build.VERSION.Release} (API {(int)Android.OS.Build.VERSION.SdkInt})";
#else
        return $"PKForge {AppInfo.Current.VersionString}";
#endif
    }

    private static string DeviceDetails()
    {
        var text = new StringBuilder().AppendLine(DeviceSummary());
#if ANDROID
        try
        {
            text.AppendLine($"Device: {Android.OS.Build.Device} · Product: {Android.OS.Build.Product} · ABIs: {string.Join(", ", Android.OS.Build.SupportedAbis ?? [])}");
            var context = Android.App.Application.Context;
            if (context.GetSystemService(Android.Content.Context.DisplayService) is Android.Hardware.Display.DisplayManager displays)
            {
                foreach (var display in displays.GetDisplays() ?? [])
                    text.AppendLine($"Display {display.DisplayId}: {display.Name} · flags 0x{(int)display.Flags:X} · state {display.State} · valid {display.IsValid}");
            }
        }
        catch (Exception error) when (error is Java.Lang.Exception or InvalidOperationException)
        {
            text.AppendLine($"(device details unavailable: {error.Message})");
        }
#endif
        return text.ToString();
    }

    private static void TryIo(Action action)
    {
        try { action(); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
    }

#if ANDROID
    /// <summary>Records a Java-side crash (a platform exception no .NET handler sees), then lets Android end the process as usual.</summary>
    private sealed class JavaCrashHandler(Java.Lang.Thread.IUncaughtExceptionHandler? next)
        : Java.Lang.Object, Java.Lang.Thread.IUncaughtExceptionHandler
    {
        public void UncaughtException(Java.Lang.Thread thread, Java.Lang.Throwable error)
        {
            WriteCrash($"Uncaught Java exception on thread {thread.Name}", null,
                Android.Util.Log.GetStackTraceString(error));
            next?.UncaughtException(thread, error);
        }
    }
#endif
}

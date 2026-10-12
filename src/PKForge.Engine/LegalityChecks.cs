using PKForge.Domain;
using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// Groups PKHeX's legality results into the topics the summary lists (Encounter, PID / IVs,
/// Moves, Ability, Ball, Ribbons, Trainer, Nickname): each topic takes its worst outcome and
/// the reasons behind it. The main topics are always listed, valid or not; anything else
/// appears as "Other" only when it is fishy or invalid.
/// </summary>
public static class LegalityChecks
{
    private const string Other = "Other";

    // Topic of each PKHeX check, in the order the summary lists them.
    private static readonly (string Name, CheckIdentifier[] Ids)[] Topics =
    [
        ("Encounter", [CheckIdentifier.Encounter, CheckIdentifier.SlotType, CheckIdentifier.GameOrigin, CheckIdentifier.Fateful,
            CheckIdentifier.Egg, CheckIdentifier.Level, CheckIdentifier.Evolution]),
        ("PID / IVs", [CheckIdentifier.PID, CheckIdentifier.EC, CheckIdentifier.IVs, CheckIdentifier.Shiny,
            CheckIdentifier.Nature, CheckIdentifier.Gender]),
        ("Moves", [CheckIdentifier.CurrentMove, CheckIdentifier.RelearnMove]),
        ("Ability", [CheckIdentifier.Ability]),
        ("Ball", [CheckIdentifier.Ball]),
        ("Ribbons", [CheckIdentifier.Ribbon, CheckIdentifier.RibbonMark]),
        ("Trainer", [CheckIdentifier.Trainer, CheckIdentifier.Language, CheckIdentifier.Handler,
            CheckIdentifier.Memory, CheckIdentifier.Geography]),
        ("Nickname", [CheckIdentifier.Nickname]),
    ];

    public static IReadOnlyList<LegalityCheck> Group(LegalityAnalysis analysis)
    {
        var context = LegalityLocalizationContext.Create(analysis);
        var findings = new List<(string Topic, LegalityJudgement Judgement, string? Reason)>();

        foreach (var result in analysis.Results)
        {
            var judgement = Judge(result.Judgement);
            findings.Add((TopicOf(result.Identifier), judgement, judgement == LegalityJudgement.Valid ? null : Reason(context.Humanize(result))));
        }
        var moves = analysis.Info.Moves;
        for (var i = 0; i < moves.Length; i++)
        {
            if (!moves[i].IsParsed || moves[i].Valid) continue;
            findings.Add(("Moves", LegalityJudgement.Invalid, $"Move {i + 1}: {moves[i].Summary(context)}"));
        }
        var relearn = analysis.Info.Relearn;
        for (var i = 0; i < relearn.Length; i++)
        {
            if (!relearn[i].IsParsed || relearn[i].Valid) continue;
            findings.Add(("Moves", LegalityJudgement.Invalid, $"Relearn move {i + 1}: {relearn[i].Summary(context)}"));
        }

        var checks = Topics.Select(topic => Summarize(topic.Name, findings)).ToList();
        if (findings.Any(f => f.Topic == Other && f.Judgement != LegalityJudgement.Valid))
            checks.Add(Summarize(Other, findings));
        return checks;
    }

    private static LegalityCheck Summarize(string topic, List<(string Topic, LegalityJudgement Judgement, string? Reason)> findings)
    {
        var mine = findings.Where(f => f.Topic == topic).ToList();
        var worst = mine.Count == 0 ? LegalityJudgement.Valid : mine.Max(f => f.Judgement);
        var reasons = mine.Where(f => f.Reason is not null).Select(f => f.Reason!).Distinct().ToList();
        return new LegalityCheck(topic, worst, reasons);
    }

    private static string TopicOf(CheckIdentifier id)
    {
        foreach (var (name, ids) in Topics)
            if (Array.IndexOf(ids, id) >= 0) return name;
        return Other;
    }

    private static LegalityJudgement Judge(Severity severity) => severity switch
    {
        Severity.Invalid => LegalityJudgement.Invalid,
        Severity.Fishy => LegalityJudgement.Fishy,
        _ => LegalityJudgement.Valid,
    };

    /// <summary>PKHeX writes "Invalid: text"; the summary shows the judgement itself, so only the text is kept.</summary>
    private static string Reason(string line)
    {
        var colon = line.IndexOf(": ", StringComparison.Ordinal);
        return colon > 0 && colon < 16 ? line[(colon + 2)..] : line;
    }
}

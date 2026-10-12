using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

public sealed class CloudAccountTests
{
    [Theory]
    [InlineData("Gabriel", "gabriel")]
    [InlineData("  ash_ketchum ", "ash_ketchum")]
    [InlineData("red.1996", "red.1996")]
    public void UsernamesAreTrimmedAndLowerCased(string raw, string expected) =>
        Assert.Equal(expected, CloudAccountClient.NormalizeUsername(raw));

    [Theory]
    [InlineData("ab")]
    [InlineData("has space")]
    [InlineData("acentuação")]
    [InlineData("name@mail.com")]
    [InlineData("")]
    [InlineData(null)]
    public void InvalidUsernamesAreRefused(string? raw) =>
        Assert.Null(CloudAccountClient.NormalizeUsername(raw));

    [Fact]
    public void AccountsNeedAKeyAndAnHttpsDatabase()
    {
        Assert.False(new CloudConfig("", "").IsConfigured);
        Assert.False(new CloudConfig("key", "http://plain.example").IsConfigured);
        Assert.True(new CloudConfig("key", "https://bank-default-rtdb.firebaseio.com").IsConfigured);
    }

    [Fact]
    public async Task UnconfiguredAccountsSayWhyInsteadOfCallingOut()
    {
        using var http = new HttpClient();
        var client = new CloudAccountClient(new CloudConfig("", ""), http);
        var error = await Assert.ThrowsAsync<CloudAccountException>(() => client.SignInAsync("gabriel", "secret1"));
        Assert.Contains("not set up", error.Message, StringComparison.Ordinal);
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace PropFirm.Infrastructure.Security;

public sealed class JwtTokenService(IConfiguration config)
{
    public string CookieName => config["Auth:CookieName"] ?? "propfirm_access";

    public string Issue(string userId, string email, string role, string displayName)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(ClaimTypes.Role, role),
            new Claim("role", role),
            new Claim("displayName", displayName),
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"] ?? "propfirm",
            audience: config["Jwt:Audience"] ?? "propfirm",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string SigningKey =>
        config["Jwt:Key"] ?? "propfirm-dev-signing-key-change-me-32chars!!";
}

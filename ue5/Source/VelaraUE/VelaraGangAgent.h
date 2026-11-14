#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "VelaraGangAgent.generated.h"

class AVelaraCharacter;

/**
 * VELARA Gang thug (v0.8.0) — three.js src/gameplay/gang.js ka UE5 mirror.
 * Old Market district thugs: Idle wander → Alert (player 42m) → Attack (20m,
 * hitscan shots + damage). Kill: loot + wanted delegation.
 *
 * NOTE: scaffold — AI logic yahan port ki gayi hai, mesh/materials Phase-2
 * mein Higgsfield refs ke baad. Spawn setup_assets.py se hota hai
 * (spawn_gang market spots).
 */
UCLASS()
class VELARAUE_API AVelaraGangAgent : public ACharacter
{
	GENERATED_BODY()

public:
	AVelaraGangAgent();

	// ---- tuning (gang.js constants ka mirror) ----
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float AlertDist = 4200.0f;      // cm (42m)

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float AttackDist = 2000.0f;     // cm (20m)

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float ThugHealth = 100.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float ShootCooldownMin = 1.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float ShootCooldownMax = 2.4f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float DamageMin = 6.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	float DamageMax = 13.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	int32 LootMin = 120;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara|Gang")
	int32 LootMax = 210;

	UFUNCTION(BlueprintCallable, Category = "Velara|Gang")
	void TakeGangDamage(float Dmg);

	UFUNCTION(BlueprintPure, Category = "Velara|Gang")
	bool IsThugDead() const { return bDead; }

	// game.js _onBulletHit → gang branch ka bridge
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnThugKilled, int32, Loot, AVelaraGangAgent*, Thug);
	UPROPERTY(BlueprintAssignable, Category = "Velara|Gang")
	FOnThugKilled OnThugKilled;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	enum class EThugState : uint8 { Idle, Alert, Attack };

	void UpdateState(float Dt);
	void FaceTowards(const FVector& Target);
	bool TryShoot(AVelaraCharacter* Hero, float Dist);

	EThugState State = EThugState::Idle;
	float Health;
	float ShootCd;
	float WanderT;
	FVector WanderDir = FVector::ForwardVector;
	FVector HomeLocation;
	bool bDead = false;
};

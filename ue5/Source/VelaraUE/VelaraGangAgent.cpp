#include "VelaraGangAgent.h"
#include "VelaraCharacter.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

AVelaraGangAgent::AVelaraGangAgent()
{
	PrimaryActorTick.bCanEverTick = true;
	Health = ThugHealth;
}

void AVelaraGangAgent::BeginPlay()
{
	Super::BeginPlay();
	HomeLocation = GetActorLocation();
	ShootCd = FMath::FRandRange(ShootCooldownMin, ShootCooldownMax);
	WanderT = FMath::FRandRange(0.5f, 3.0f);
}

void AVelaraGangAgent::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bDead) return;
	UpdateState(DeltaSeconds);
}

void AVelaraGangAgent::UpdateState(float Dt)
{
	AVelaraCharacter* Hero = Cast<AVelaraCharacter>(
		UGameplayStatics::GetPlayerCharacter(this, 0));
	if (!Hero) return;

	const float Dist = FVector::Dist(GetActorLocation(), Hero->GetActorLocation());

	// state machine — gang.js ka mirror
	if (Dist <= AttackDist) State = EThugState::Attack;
	else if (Dist <= AlertDist) State = EThugState::Alert;
	else State = EThugState::Idle;

	switch (State)
	{
	case EThugState::Idle:
	{
		// home ke 6m ke andar wander
		WanderT -= Dt;
		if (WanderT <= 0.f)
		{
			WanderT = FMath::FRandRange(2.f, 5.f);
			const float A = FMath::FRandRange(0.f, 2.f * PI);
			WanderDir = FVector(FMath::Sin(A), FMath::Cos(A), 0.f);
		}
		if (FVector::Dist2D(GetActorLocation(), HomeLocation) > 600.f)
		{
			WanderDir = (HomeLocation - GetActorLocation()).GetSafeNormal2D();
		}
		AddMovementInput(WanderDir, 0.35f);
		break;
	}
	case EThugState::Alert:
	{
		FaceTowards(Hero->GetActorLocation());
		AddMovementInput((Hero->GetActorLocation() - GetActorLocation()).GetSafeNormal2D(), 0.6f);
		break;
	}
	case EThugState::Attack:
	{
		FaceTowards(Hero->GetActorLocation());
		ShootCd -= Dt;
		if (ShootCd <= 0.f)
		{
			ShootCd = FMath::FRandRange(ShootCooldownMin, ShootCooldownMax);
			TryShoot(Hero, Dist);
		}
		break;
	}
	}
}

void AVelaraGangAgent::FaceTowards(const FVector& Target)
{
	const FVector Dir = (Target - GetActorLocation()).GetSafeNormal2D();
	if (!Dir.IsNearlyZero())
	{
		SetActorRotation(FRotator(0.f, Dir.Rotation().Yaw, 0.f));
	}
}

bool AVelaraGangAgent::TryShoot(AVelaraCharacter* Hero, float Dist)
{
	// hitscan: doori ke hisaab se accuracy (gang.js hitChance mirror)
	const float HitChance = FMath::Max(0.25f, 0.9f - (Dist / 4500.f));
	if (FMath::FRand() < HitChance)
	{
		const float Dmg = FMath::FRandRange(DamageMin, DamageMax);
		// Phase-2: hero TakeDamage + tracer VFX yahan — scaffold TODO
		UE_LOG(LogTemp, Log, TEXT("[VelaraGang] thug shoots hero for %.1f"), Dmg);
		return true;
	}
	return false;
}

void AVelaraGangAgent::TakeGangDamage(float Dmg)
{
	if (bDead) return;
	Health -= Dmg;
	// flinch → turant aggressive (gang.js mirror)
	State = EThugState::Attack;
	ShootCd = FMath::Min(ShootCd, 0.4f);

	if (Health <= 0.f)
	{
		bDead = true;
		const int32 Loot = FMath::RandRange(LootMin, LootMax);
		OnThugKilled.Broadcast(Loot, this);
		// gir ja (ragdoll Phase-2; abhi simple rotate)
		SetActorRotation(FRotator(0.f, GetActorRotation().Yaw, 90.f));
		SetActorTickEnabled(false);
	}
}

// utils/missionHelpers.js

/**
 * Vérifier si un utilisateur peut publier une mission selon son pack
 */
exports.canPublishMission = async (userId, Mission) => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const missionsCount = await Mission.countDocuments({
        recruiter: userId,
        createdAt: { $gte: firstDayOfMonth }
    });
    
    return missionsCount;
};

/**
 * Obtenir les limites selon le pack
 */
exports.getPackLimits = (packType) => {
    const limits = {
        basic: {
            missionsParMois: 3,
            contactsParMois: 5,
            boostDisponible: false
        },
        premium: {
            missionsParMois: 8,
            contactsParMois: 10,
            boostDisponible: true
        },
        accompagnement: {
            missionsParMois: Infinity,
            contactsParMois: Infinity,
            boostDisponible: true
        }
    };
    
    return limits[packType] || limits.basic;
};

/**
 * Calculer la durée d'une mission en heures
 */
exports.calculateMissionDuration = (dateDebut, dateFin, heureDebut, heureFin) => {
    const start = new Date(`${dateDebut}T${heureDebut}`);
    const end = new Date(`${dateFin}T${heureFin}`);
    
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 10) / 10; // Arrondir à 1 décimale
};

/**
 * Formater le message d'évaluation selon la note
 */
exports.getEvaluationMessage = (note, nomPartimer) => {
    const messages = {
        1: `Bonjour ${nomPartimer}, tu as reçu 1 étoile pour ta mission. Ne lâche rien 💪, chaque mission est une chance de progresser.`,
        2: `Bonjour ${nomPartimer}, tu as obtenu 2 étoiles. Bon début 👌, continue à t'améliorer !`,
        3: `Bonjour ${nomPartimer}, le recruteur t'a donné 3 étoiles. Beau travail 👍, vise encore plus haut !`,
        4: `Bonjour ${nomPartimer}, félicitations 👏 ! Tu as obtenu 4 étoiles pour ta mission. Presque l'excellence 🌟 !`,
        5: `Bonjour ${nomPartimer}, bravo 🎉 ! Tu as reçu 5 étoiles pour ton travail. Continue comme ça`
    };
    
    return messages[note] || messages[3];
};

/**
 * Vérifier si une mission est éligible pour boost (Premium)
 */
exports.canBoostMission = (userPack) => {
    return userPack === 'premium' || userPack === 'accompagnement';
};

/**
 * Calculer le score de pertinence d'un partimer pour une mission
 */
exports.calculateMatchScore = (partimerProfile, mission) => {
    let score = 0;
    
    // Ville (40 points)
    if (partimerProfile.ville === mission.ville) {
        score += 40;
    }
    
    // Compétences correspondantes (30 points)
    if (partimerProfile.competences && mission.typeService) {
        const hasMatchingSkill = partimerProfile.competences.some(comp => 
            comp.toLowerCase().includes(mission.typeService.toLowerCase())
        );
        if (hasMatchingSkill) score += 30;
    }
    
    // Disponibilité (20 points)
    // À implémenter selon le système de disponibilité
    
    // Note moyenne (10 points)
    if (partimerProfile.noteMoyenne) {
        score += (partimerProfile.noteMoyenne / 5) * 10;
    }
    
    return Math.round(score);
};

/**
 * Générer un résumé de mission pour notification
 */
exports.generateMissionSummary = (mission) => {
    return {
        titre: `${mission.typeService} - ${mission.ville}`,
        description: mission.description.substring(0, 100) + '...',
        date: mission.dateDebut,
        honoraires: `${mission.honoraires.montant} DH ${mission.honoraires.type}`,
        modalite: mission.modalite
    };
};

/**
 * Vérifier les missions expirées et mettre à jour leur statut
 */
exports.checkAndUpdateExpiredMissions = async (Mission) => {
    const expiredMissions = await Mission.updateMany(
        {
            dateExpiration: { $lt: new Date() },
            statut: 'active'
        },
        {
            $set: { statut: 'expiree' }
        }
    );
    
    return expiredMissions.modifiedCount;
};

/**
 * Filtrer les informations sensibles avant d'envoyer la mission
 */
exports.sanitizeMissionData = (mission, userRole) => {
    const sanitized = mission.toObject();
    
    // Si l'utilisateur n'est pas le recruteur, masquer certaines infos
    if (userRole !== 'recruiter') {
        // Masquer les candidatures complètes
        if (sanitized.candidatures) {
            sanitized.candidaturesCount = sanitized.candidatures.length;
            delete sanitized.candidatures;
        }
    }
    
    return sanitized;
};

/**
 * Valider la cohérence des horaires
 */
exports.validateSchedule = (dateDebut, dateFin, heureDebut, heureFin) => {
    const errors = [];
    
    // Vérifier que la date de début est avant la date de fin
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    if (debut > fin) {
        errors.push('La date de début doit être avant la date de fin');
    }
    
    // Si même jour, vérifier les heures
    if (debut.toDateString() === fin.toDateString()) {
        const [heureD, minuteD] = heureDebut.split(':').map(Number);
        const [heureF, minuteF] = heureFin.split(':').map(Number);
        
        if (heureD > heureF || (heureD === heureF && minuteD >= minuteF)) {
            errors.push('L\'heure de début doit être avant l\'heure de fin');
        }
    }
    
    // Vérifier que la mission n'est pas dans le passé
    const now = new Date();
    if (debut < now) {
        errors.push('La mission ne peut pas commencer dans le passé');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = exports;